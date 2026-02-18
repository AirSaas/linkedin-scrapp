import { logger, schedules } from "@trigger.dev/sdk/v3";
import { getSupabase } from "./lib/supabase.js";
import { unipile } from "./lib/unipile.js";
import { sleep } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const HUBSPOT_API_BASE = "https://api.hubapi.com";

const RATE_LIMIT = {
  BETWEEN_MESSAGES: 200,
  BETWEEN_THREADS: 500,
  BETWEEN_ACCOUNTS: 2000,
  BETWEEN_HUBSPOT_CALLS: 150,
  HUBSPOT_429_PAUSE: 10000,
};

// ============================================
// TYPES
// ============================================
interface TeamAccount {
  linkedin_urn: string;
  unipile_account_id: string;
  hubspot_id: string | null;
}

interface GhostGeniusParticipant {
  id: string;
  type: string;
  full_name: string;
  url: string;
  profile_picture: string[];
}

interface UnipileChat {
  id: string;
  provider_id: string;
  timestamp: string;
  unread_count: number;
  attendee_provider_id?: string;
}

interface UnipileAttendee {
  provider_id: string;
  name: string;
  profile_url: string;
  picture_url: string | null;
  is_self: number;
  specifics?: { occupation?: string };
}

interface UnipileMessage {
  id: string;
  provider_id: string;
  chat_provider_id: string;
  timestamp: string;
  text: string;
  sender_id: string;
  seen: number;
}

// ============================================
// SCHEDULED TASK
// ============================================
export const importLinkedinMessagesTask = schedules.task({
  id: "import-linkedin-messages",
  maxDuration: 600,
  run: async () => {
    logger.info("=== START import-linkedin-messages ===");

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const afterISO = cutoffDate.toISOString();
    logger.info(`Scanning chats since ${afterISO}`);

    // 1. Get team accounts
    const accounts = await getTeamAccounts();
    logger.info(`${accounts.length} accounts to process`);

    // 2. Build HubSpot owners cache
    const hubspotOwners = await getHubSpotOwnersCache();
    logger.info(`Cached ${hubspotOwners.size} HubSpot owners`);

    let totalThreads = 0;
    let newThreads = 0;
    let totalMessages = 0;
    let newMessages = 0;
    let hubspotSent = 0;
    let zapierSent = 0;
    let errors = 0;

    // 3. Process each account
    for (const account of accounts) {
      try {
        logger.info(
          `Processing account: ${account.linkedin_urn} (unipile: ${account.unipile_account_id})`
        );

        // Fetch owner profile for participant reconstruction
        const ownerProfile = await fetchOwnerProfile(
          account.linkedin_urn,
          account.unipile_account_id
        );

        // Get recent chats
        const chats = await getAllChats(account.unipile_account_id, afterISO);
        logger.info(`${chats.length} chats with recent activity`);

        for (const chat of chats) {
          try {
            const threadId = chat.provider_id;
            totalThreads++;

            // Fetch attendees (needed for both thread insert and sender_data)
            const attendees = await fetchAttendees(chat.id);
            await sleep(RATE_LIMIT.BETWEEN_MESSAGES);

            // Reconstruct participants in Ghost Genius format
            const participants = reconstructParticipants(
              attendees,
              ownerProfile
            );
            const participantLookup = new Map<string, GhostGeniusParticipant>();
            for (const p of participants) {
              participantLookup.set(p.id, p);
            }

            const participantsCount = participants.length;
            let mainParticipantId: string | null = null;
            if (participantsCount === 2) {
              mainParticipantId =
                attendees.length > 0 ? attendees[0].provider_id : null;
            }

            // Check if thread exists
            const threadExists = await recordExists(
              "scrapped_linkedin_threads",
              threadId
            );

            if (!threadExists) {
              const threadRecord = {
                id: threadId,
                last_activity_at: chat.timestamp,
                is_read: chat.unread_count === 0,
                participants: JSON.stringify(participants),
                participant_owner_id: account.linkedin_urn,
                participants_ids: [
                  ...attendees.map((a) => a.provider_id),
                  account.linkedin_urn,
                ],
                participants_numbers: participantsCount,
                main_participant_id: mainParticipantId,
              };

              await insertRecord("scrapped_linkedin_threads", threadRecord);
              newThreads++;
              logger.debug(`Inserted thread: ${threadId}`);
            }

            // Fetch messages
            const messages = await getAllMessages(chat.id);

            for (const msg of messages) {
              try {
                const messageId = `urn:li:msg_message:(urn:li:fsd_profile:${account.linkedin_urn},${msg.provider_id})`;
                totalMessages++;

                const msgExists = await recordExists(
                  "scrapped_linkedin_messages",
                  messageId
                );
                if (msgExists) continue;

                const senderData = participantLookup.get(msg.sender_id) ?? null;

                const messageRecord = {
                  id: messageId,
                  thread_id: threadId,
                  message_date: msg.timestamp,
                  is_read: msg.seen > 0,
                  text: msg.text || "",
                  sender_id: msg.sender_id,
                  sender_data: senderData ? JSON.stringify(senderData) : null,
                  participant_owner_id: account.linkedin_urn,
                  participants_numbers: participantsCount,
                  main_participant_id: mainParticipantId,
                };

                await insertRecord("scrapped_linkedin_messages", messageRecord);
                newMessages++;
                logger.debug(`Inserted message: ${messageId}`);

                // HubSpot + Zapier for 1:1 threads
                if (participantsCount === 2 && mainParticipantId) {
                  try {
                    const hsCommId = await sendToHubSpot(
                      messageRecord,
                      hubspotOwners
                    );
                    if (hsCommId) {
                      await updateHubSpotCommId(messageId, hsCommId);
                      hubspotSent++;
                    }
                  } catch (err) {
                    const m = err instanceof Error ? err.message : String(err);
                    logger.error(`HubSpot error for ${messageId}: ${m}`);
                    errors++;
                  }

                  try {
                    await sendToZapier(messageRecord, participants);
                    zapierSent++;
                  } catch (err) {
                    const m = err instanceof Error ? err.message : String(err);
                    logger.error(`Zapier error for ${messageId}: ${m}`);
                    errors++;
                  }
                }

                await sleep(RATE_LIMIT.BETWEEN_MESSAGES);
              } catch (err) {
                const m = err instanceof Error ? err.message : String(err);
                logger.error(`Error processing message: ${m}`);
                errors++;
              }
            }

            await sleep(RATE_LIMIT.BETWEEN_THREADS);
          } catch (err) {
            const m = err instanceof Error ? err.message : String(err);
            logger.error(`Error processing chat ${chat.provider_id}: ${m}`);
            errors++;
          }
        }

        await sleep(RATE_LIMIT.BETWEEN_ACCOUNTS);
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        logger.error(`Error processing account ${account.linkedin_urn}: ${m}`);
        errors++;
      }
    }

    const summary = {
      success: true,
      accounts: accounts.length,
      totalThreads,
      newThreads,
      totalMessages,
      newMessages,
      hubspotSent,
      zapierSent,
      errors,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// SUPABASE HELPERS
// ============================================
async function getTeamAccounts(): Promise<TeamAccount[]> {
  const { data, error } = await getSupabase()
    .from("workspace_team")
    .select("linkedin_urn, unipile_account_id, hubspot_id")
    .not("unipile_account_id", "is", null)
    .not("linkedin_urn", "is", null)
    .neq("linkedin_urn", "");

  if (error) throw new Error(`Failed to fetch accounts: ${error.message}`);
  return (data ?? []) as TeamAccount[];
}

async function getHubSpotOwnersCache(): Promise<Map<string, string>> {
  const { data, error } = await getSupabase()
    .from("workspace_team")
    .select("linkedin_urn, hubspot_id")
    .not("hubspot_id", "is", null);

  if (error)
    throw new Error(`Failed to fetch HubSpot owners: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.linkedin_urn, row.hubspot_id);
  }
  return map;
}

async function recordExists(
  table: string,
  recordId: string
): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from(table)
    .select("id")
    .eq("id", recordId)
    .limit(1);

  if (error) {
    logger.error(`Error checking ${table} for ${recordId}: ${error.message}`);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

async function insertRecord(
  table: string,
  record: Record<string, unknown>
): Promise<void> {
  const { error } = await getSupabase().from(table).insert(record);
  if (error)
    throw new Error(`Failed to insert into ${table}: ${error.message}`);
}

async function updateHubSpotCommId(
  messageId: string,
  hubspotCommId: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("scrapped_linkedin_messages")
    .update({ hubspot_communication_id: hubspotCommId })
    .eq("id", messageId);

  if (error) {
    logger.error(
      `Failed to update hubspot_communication_id for ${messageId}: ${error.message}`
    );
  }
}

// ============================================
// UNIPILE HELPERS
// ============================================
async function fetchOwnerProfile(
  linkedinUrn: string,
  accountId: string
): Promise<GhostGeniusParticipant> {
  try {
    const user = (await unipile.getUser(linkedinUrn, accountId)) as {
      first_name?: string;
      last_name?: string;
      public_profile_url?: string;
      profile_picture_url?: string;
    };

    return {
      id: linkedinUrn,
      type: "person",
      full_name:
        `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() ||
        "Unknown",
      url: user.public_profile_url ?? "",
      profile_picture: user.profile_picture_url
        ? [user.profile_picture_url]
        : [],
    };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    logger.warn(`Could not fetch owner profile for ${linkedinUrn}: ${m}`);
    return {
      id: linkedinUrn,
      type: "person",
      full_name: "Unknown",
      url: "",
      profile_picture: [],
    };
  }
}

async function getAllChats(
  accountId: string,
  afterISO: string
): Promise<UnipileChat[]> {
  const allChats: UnipileChat[] = [];
  let cursor: string | undefined;

  do {
    const response = (await unipile.getChats(
      accountId,
      100,
      afterISO,
      cursor
    )) as {
      items?: UnipileChat[];
      cursor?: string;
    };

    const items = response.items ?? [];
    allChats.push(...items);

    cursor = response.cursor ?? undefined;
    if (items.length > 0) await sleep(RATE_LIMIT.BETWEEN_MESSAGES);
  } while (cursor);

  return allChats;
}

async function fetchAttendees(chatId: string): Promise<UnipileAttendee[]> {
  const response = (await unipile.getChatAttendees(chatId)) as
    | UnipileAttendee[]
    | { items?: UnipileAttendee[] };

  // API may return array directly or { items: [...] }
  if (Array.isArray(response)) {
    return response.filter((a) => a.is_self === 0);
  }
  return (response.items ?? []).filter((a) => a.is_self === 0);
}

async function getAllMessages(chatId: string): Promise<UnipileMessage[]> {
  const allMessages: UnipileMessage[] = [];
  let cursor: string | undefined;

  do {
    const response = (await unipile.getChatMessages(
      chatId,
      100,
      cursor
    )) as {
      items?: UnipileMessage[];
      cursor?: string;
    };

    const items = response.items ?? [];
    allMessages.push(...items);

    cursor = response.cursor ?? undefined;
    if (items.length > 0) await sleep(RATE_LIMIT.BETWEEN_MESSAGES);
  } while (cursor);

  return allMessages;
}

// ============================================
// PARTICIPANT RECONSTRUCTION
// ============================================
function reconstructParticipants(
  attendees: UnipileAttendee[],
  ownerProfile: GhostGeniusParticipant
): GhostGeniusParticipant[] {
  const participants: GhostGeniusParticipant[] = attendees.map((a) => ({
    id: a.provider_id,
    type: "person",
    full_name: a.name ?? "",
    url: a.profile_url ?? "",
    profile_picture: a.picture_url ? [a.picture_url] : [],
  }));

  // Add owner
  participants.push(ownerProfile);

  return participants;
}

// ============================================
// HUBSPOT HELPERS
// ============================================
async function callHubSpot(
  url: string,
  method: string,
  payload?: unknown
): Promise<Record<string, unknown>> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN ?? "";

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (payload && ["POST", "PUT", "PATCH"].includes(method)) {
    options.body = JSON.stringify(payload);
  }

  const res = await fetch(url, options);

  if (res.status === 429) {
    logger.warn("HubSpot rate limit 429, pausing 10s...");
    await sleep(RATE_LIMIT.HUBSPOT_429_PAUSE);
    return callHubSpot(url, method, payload);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 300)}`);
  }

  const text = await res.text();
  return text.length > 0 ? JSON.parse(text) : {};
}

async function findHubSpotContact(
  linkedinUrn: string
): Promise<{ id: string } | null> {
  const response = await callHubSpot(
    `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
    "POST",
    {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "linkedinprofileurn",
              operator: "EQ",
              value: linkedinUrn,
            },
          ],
        },
      ],
      limit: 1,
    }
  );

  const results = (response.results ?? []) as { id: string }[];
  return results.length > 0 ? results[0] : null;
}

async function getContactDeals(contactId: string): Promise<string[]> {
  try {
    const response = await callHubSpot(
      `${HUBSPOT_API_BASE}/crm/v4/objects/contacts/${contactId}/associations/deals`,
      "GET"
    );

    const results = (response.results ?? []) as {
      toObjectId?: string;
      id?: string;
    }[];
    return results.map((r) => r.toObjectId ?? r.id ?? "").filter(Boolean);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to fetch deals for contact ${contactId}: ${m}`);
    return [];
  }
}

async function sendToHubSpot(
  messageRecord: Record<string, unknown>,
  hubspotOwners: Map<string, string>
): Promise<string | null> {
  const ownerUrn = messageRecord.participant_owner_id as string;
  const hubspotOwnerId = hubspotOwners.get(ownerUrn);
  if (!hubspotOwnerId) {
    logger.debug(`No HubSpot owner for ${ownerUrn}`);
    return null;
  }

  const mainParticipantId = messageRecord.main_participant_id as string;
  const contact = await findHubSpotContact(mainParticipantId);
  await sleep(RATE_LIMIT.BETWEEN_HUBSPOT_CALLS);

  if (!contact) {
    logger.debug(`No HubSpot contact for ${mainParticipantId}`);
    return null;
  }

  const direction =
    messageRecord.sender_id === ownerUrn ? "Outbound" : "Inbound";
  const communicationBody = `${direction}: ${messageRecord.text}`;

  const contactDeals = await getContactDeals(contact.id);
  await sleep(RATE_LIMIT.BETWEEN_HUBSPOT_CALLS);

  const associations: Record<string, unknown>[] = [
    {
      to: { id: contact.id },
      types: [
        { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 81 },
      ],
    },
  ];

  for (const dealId of contactDeals) {
    associations.push({
      to: { id: dealId },
      types: [
        { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 87 },
      ],
    });
  }

  const response = await callHubSpot(
    `${HUBSPOT_API_BASE}/crm/v3/objects/communications`,
    "POST",
    {
      properties: {
        hs_communication_channel_type: "LINKEDIN_MESSAGE",
        hs_communication_logged_from: "CRM",
        hs_communication_body: communicationBody,
        hs_timestamp: messageRecord.message_date,
        hubspot_owner_id: hubspotOwnerId,
      },
      associations,
    }
  );

  const hsId = response.id as string | undefined;
  if (hsId) {
    logger.info(
      `HubSpot communication created: ${hsId} (${direction}) for message ${messageRecord.id}`
    );
  }
  await sleep(RATE_LIMIT.BETWEEN_HUBSPOT_CALLS);
  return hsId ?? null;
}

// ============================================
// ZAPIER WEBHOOK
// ============================================
async function sendToZapier(
  messageRecord: Record<string, unknown>,
  participants: GhostGeniusParticipant[]
): Promise<void> {
  const webhookUrl = process.env.webhook_linkedin_message;
  if (!webhookUrl) {
    logger.warn("webhook_linkedin_message not configured, skipping");
    return;
  }

  const senderId = messageRecord.sender_id as string;
  const ownerUrn = messageRecord.participant_owner_id as string;
  const mainParticipantId = messageRecord.main_participant_id as string;

  const senderInfo = participants.find((p) => p.id === senderId);
  const receiverId = senderId === ownerUrn ? mainParticipantId : ownerUrn;
  const receiverInfo = participants.find((p) => p.id === receiverId);

  const enrichedMessage = {
    id: messageRecord.id,
    thread_id: messageRecord.thread_id,
    message_date: messageRecord.message_date,
    is_read: messageRecord.is_read,
    text: messageRecord.text,
    participant_owner_id: ownerUrn,
    participants_numbers: messageRecord.participants_numbers,
    main_participant_id: mainParticipantId,

    sender: {
      id: senderId,
      fullname: senderInfo?.full_name ?? "Unknown",
      linkedin_url: senderInfo?.url ?? null,
      position: "",
      profile_picture:
        senderInfo?.profile_picture?.[0] ?? null,
    },

    receiver: {
      id: receiverId,
      fullname: receiverInfo?.full_name ?? "Unknown",
      linkedin_url: receiverInfo?.url ?? null,
      position: "",
      profile_picture:
        receiverInfo?.profile_picture?.[0] ?? null,
    },

    conversation: {
      direction: senderId === ownerUrn ? "outbound" : "inbound",
      is_owner_sender: senderId === ownerUrn,
      thread_id: messageRecord.thread_id,
      participants_count: messageRecord.participants_numbers,
    },

    timestamps: {
      message_date: messageRecord.message_date,
      message_datetime: messageRecord.message_date,
      processed_at: new Date().toISOString(),
    },
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enrichedMessage),
  });

  if (res.ok) {
    logger.debug(`Zapier webhook sent for ${messageRecord.id}`);
  } else {
    const text = await res.text();
    logger.error(`Zapier webhook failed: ${res.status} — ${text}`);
  }
}
