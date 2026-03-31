import { logger, schedules } from "@trigger.dev/sdk/v3";
import { getSupabase } from "./lib/supabase.js";
import { unipile } from "./lib/unipile.js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";
import { callHubSpot } from "./lib/hubspot.js";

// ============================================
// CONFIGURATION
// ============================================
const LOOKBACK_HOURS = 12;
const HUBSPOT_API_BASE = "https://api.hubapi.com";
const BETWEEN_HUBSPOT_CALLS = 150;

const RATE_LIMIT = {
  BETWEEN_MESSAGES: 200,
  BETWEEN_THREADS: 500,
  BETWEEN_ACCOUNTS: 2000,
};

// ============================================
// TYPES
// ============================================
interface WhatsAppAccount {
  unipile_whatsapp_account_id: string;
  hubspot_id: string | null;
  firstname: string;
  lastname: string;
}

interface WhatsAppChat {
  id: string;
  provider_id: string;
  timestamp: string;
  unread_count: number;
  type: number; // 0 = 1:1
  attendee_public_identifier?: string;
}

interface WhatsAppAttendee {
  provider_id: string; // @lid
  name: string;
  public_identifier: string; // phone@s.whatsapp.net
  is_self: number;
  specifics?: {
    phone_number?: string; // E.164 format
    provider?: string;
    lid?: string;
  };
}

interface WhatsAppMessage {
  id: string;
  provider_id: string;
  timestamp: string;
  text: string;
  sender_id: string;
  sender_public_identifier?: string;
  is_sender: number;
  seen: number;
  attachments: unknown[];
  original?: string;
}

// ============================================
// SCHEDULED TASK
// ============================================
export const importWhatsappMessagesTask = schedules.task({
  id: "import-whatsapp-messages",
  maxDuration: 600,
  run: async () => {
    logger.info("=== START import-whatsapp-messages ===");

    const cutoffDate = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
    const afterISO = cutoffDate.toISOString();
    logger.info(`Scanning chats since ${afterISO} (${LOOKBACK_HOURS}h lookback)`);

    // 1. Get WhatsApp team accounts
    const accounts = await getWhatsAppAccounts();
    logger.info(`${accounts.length} WhatsApp accounts to process`);

    // 2. Build HubSpot owners cache (whatsapp_account_id → hubspot_id)
    const hubspotOwners = await getHubSpotOwnersCache();
    logger.info(`Cached ${hubspotOwners.size} HubSpot owners`);

    let totalThreads = 0;
    let newThreads = 0;
    let totalMessages = 0;
    let newMessages = 0;
    let hubspotSent = 0;
    let hubspotSkipped = 0;
    const errorDetails: TaskError[] = [];

    // 3. Process each account
    for (const account of accounts) {
      const accountLabel = `${account.firstname} ${account.lastname}`;
      try {
        logger.info(`Processing ${accountLabel} (${account.unipile_whatsapp_account_id})`);

        const chats = await getAllChats(account.unipile_whatsapp_account_id, afterISO);
        logger.info(`${chats.length} chats with recent activity`);

        for (const chat of chats) {
          try {
            // Skip groups (type !== 0)
            if (chat.type !== 0) {
              logger.debug(`Skipping group chat: ${chat.id}`);
              continue;
            }

            totalThreads++;

            // Fetch attendees
            const attendees = await fetchAttendees(chat.id);
            await sleep(RATE_LIMIT.BETWEEN_MESSAGES);

            // Skip self-threads (no attendees = messaging yourself)
            if (attendees.length === 0) {
              logger.debug(`Skipping self-thread: ${chat.id}`);
              continue;
            }

            const contact = attendees[0];
            const contactPhoneE164 = contact.specifics?.phone_number ?? extractPhoneFromIdentifier(contact.public_identifier);

            // Upsert thread
            const threadExists = await recordExists("scrapped_whatsapp_threads", chat.id);

            if (!threadExists) {
              await getSupabase().from("scrapped_whatsapp_threads").insert({
                id: chat.id,
                phone_number: contact.public_identifier,
                contact_name: contact.name,
                contact_phone_e164: contactPhoneE164,
                last_activity_at: chat.timestamp,
                is_read: chat.unread_count === 0,
                participant_owner_id: account.unipile_whatsapp_account_id,
                participants_numbers: 2,
              });
              newThreads++;
              logger.debug(`Inserted thread: ${chat.id} (${contact.name})`);
            } else {
              await getSupabase()
                .from("scrapped_whatsapp_threads")
                .update({
                  last_activity_at: chat.timestamp,
                  is_read: chat.unread_count === 0,
                  contact_name: contact.name,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", chat.id);
            }

            // Fetch messages
            const messages = await getAllMessages(chat.id);

            for (const msg of messages) {
              try {
                totalMessages++;

                const msgExists = await recordExists("scrapped_whatsapp_messages", msg.id);
                if (msgExists) continue;

                // Determine sender info
                const isSender = msg.is_sender === 1;
                const senderName = isSender ? accountLabel : contact.name;
                const senderPhone = isSender
                  ? undefined
                  : contact.public_identifier;

                const messageRecord = {
                  id: msg.id,
                  thread_id: chat.id,
                  provider_id: msg.provider_id,
                  message_date: msg.timestamp,
                  is_read: msg.seen > 0,
                  text: msg.text || "",
                  is_sender: isSender,
                  sender_id: msg.sender_id,
                  sender_name: senderName,
                  sender_phone: senderPhone,
                  participant_owner_id: account.unipile_whatsapp_account_id,
                  contact_phone_e164: contactPhoneE164,
                  attachments: msg.attachments ?? [],
                  original: msg.original ? safeParseJSON(msg.original) : null,
                };

                const { error: insertError } = await getSupabase()
                  .from("scrapped_whatsapp_messages")
                  .insert(messageRecord);

                if (insertError) {
                  throw new Error(`Insert failed: ${insertError.message}`);
                }

                newMessages++;
                logger.debug(`Inserted message: ${msg.id}`);

                // Try HubSpot match for 1:1 threads
                if (contactPhoneE164) {
                  try {
                    const hsCommId = await sendWhatsAppToHubSpot(
                      messageRecord,
                      contactPhoneE164,
                      hubspotOwners.get(account.unipile_whatsapp_account_id) ?? null
                    );
                    if (hsCommId) {
                      await updateHubSpotCommId(msg.id, hsCommId);
                      hubspotSent++;
                    } else {
                      hubspotSkipped++;
                    }
                  } catch (err) {
                    const m = err instanceof Error ? err.message : String(err);
                    logger.error(`HubSpot error for ${msg.id}: ${m}`);
                    errorDetails.push({ type: "HubSpot Sync", code: "exception", message: m, profile: msg.id });
                  }
                }

                await sleep(RATE_LIMIT.BETWEEN_MESSAGES);
              } catch (err) {
                const m = err instanceof Error ? err.message : String(err);
                logger.error(`Error processing message: ${m}`);
                errorDetails.push({ type: "Message Processing", code: "exception", message: m });
              }
            }

            await sleep(RATE_LIMIT.BETWEEN_THREADS);
          } catch (err) {
            const m = err instanceof Error ? err.message : String(err);
            logger.error(`Error processing chat ${chat.id}: ${m}`);
            errorDetails.push({ type: "Chat Processing", code: "exception", message: m, profile: chat.id });
          }
        }

        await sleep(RATE_LIMIT.BETWEEN_ACCOUNTS);
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        logger.error(`Error processing account ${accountLabel}: ${m}`);
        errorDetails.push({ type: "Account Processing", code: "exception", message: m, profile: accountLabel });
      }
    }

    // Send error recap to #script-logs
    await sendErrorToScriptLogs("Import WhatsApp Messages", [{
      label: "Messages",
      inserted: newMessages,
      skipped: totalMessages - newMessages,
      errors: errorDetails,
    }]);

    const summary = {
      success: true,
      accounts: accounts.length,
      totalThreads,
      newThreads,
      totalMessages,
      newMessages,
      hubspotSent,
      hubspotSkipped,
      errors: errorDetails.length,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// SUPABASE HELPERS
// ============================================
async function getWhatsAppAccounts(): Promise<WhatsAppAccount[]> {
  const { data, error } = await getSupabase()
    .from("workspace_team")
    .select("unipile_whatsapp_account_id, hubspot_id, firstname, lastname")
    .not("unipile_whatsapp_account_id", "is", null);

  if (error) throw new Error(`Failed to fetch WhatsApp accounts: ${error.message}`);
  return (data ?? []) as WhatsAppAccount[];
}

async function getHubSpotOwnersCache(): Promise<Map<string, string>> {
  const { data, error } = await getSupabase()
    .from("workspace_team")
    .select("unipile_whatsapp_account_id, hubspot_id")
    .not("unipile_whatsapp_account_id", "is", null)
    .not("hubspot_id", "is", null);

  if (error) throw new Error(`Failed to fetch HubSpot owners: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.unipile_whatsapp_account_id, row.hubspot_id);
  }
  return map;
}

async function recordExists(table: string, recordId: string): Promise<boolean> {
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

async function updateHubSpotCommId(messageId: string, hubspotCommId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("scrapped_whatsapp_messages")
    .update({ hubspot_communication_id: hubspotCommId })
    .eq("id", messageId);

  if (error) {
    logger.error(`Failed to update hubspot_communication_id for ${messageId}: ${error.message}`);
  }
}

// ============================================
// UNIPILE HELPERS
// ============================================
async function getAllChats(accountId: string, afterISO: string): Promise<WhatsAppChat[]> {
  const allChats: WhatsAppChat[] = [];
  let cursor: string | undefined;

  do {
    const response = (await unipile.getChats(accountId, 100, afterISO, cursor)) as {
      items?: WhatsAppChat[];
      cursor?: string;
    };

    const items = response.items ?? [];
    allChats.push(...items);

    cursor = response.cursor ?? undefined;
    if (items.length > 0) await sleep(RATE_LIMIT.BETWEEN_MESSAGES);
  } while (cursor);

  return allChats;
}

async function fetchAttendees(chatId: string): Promise<WhatsAppAttendee[]> {
  const response = (await unipile.getChatAttendees(chatId)) as
    | WhatsAppAttendee[]
    | { items?: WhatsAppAttendee[] };

  if (Array.isArray(response)) {
    return response.filter((a) => a.is_self === 0);
  }
  return (response.items ?? []).filter((a) => a.is_self === 0);
}

async function getAllMessages(chatId: string): Promise<WhatsAppMessage[]> {
  const allMessages: WhatsAppMessage[] = [];
  let cursor: string | undefined;

  do {
    const response = (await unipile.getChatMessages(chatId, 100, cursor)) as {
      items?: WhatsAppMessage[];
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
// PHONE NUMBER HELPERS
// ============================================

/** Extract phone from WhatsApp identifier: "33651810425@s.whatsapp.net" → "+33651810425" */
function extractPhoneFromIdentifier(identifier: string): string | null {
  const match = identifier.match(/^(\d+)@/);
  return match ? `+${match[1]}` : null;
}

/** Normalize any phone string to just digits: "+33 6 51 81 04 25" → "33651810425" */
function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Extract last 9 digits for comparison (ignores country prefix) */
function last9Digits(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  return digits.slice(-9);
}

// ============================================
// HUBSPOT MATCHING BY PHONE
// ============================================

/**
 * Search HubSpot for a contact by phone number.
 * Strategy: use full-text query with last 9 digits, then verify match in code.
 */
async function findHubSpotContactByPhone(phoneE164: string): Promise<{ id: string } | null> {
  const searchDigits = last9Digits(phoneE164);
  if (searchDigits.length < 6) return null;

  // HubSpot search API: query searches across default searchable properties including phone
  const response = await callHubSpot(
    `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
    "POST",
    {
      query: searchDigits,
      properties: ["phone", "mobilephone", "hs_whatsapp_phone_number", "firstname", "lastname"],
      limit: 10,
    }
  );
  await sleep(BETWEEN_HUBSPOT_CALLS);

  const results = (response.results ?? []) as {
    id: string;
    properties?: Record<string, string | null>;
  }[];

  if (results.length === 0) return null;

  // Verify: at least one phone field must match on last 9 digits
  const matches = results.filter((r) => {
    const props = r.properties ?? {};
    const phones = [props.phone, props.mobilephone, props.hs_whatsapp_phone_number].filter(Boolean) as string[];
    return phones.some((p) => last9Digits(p) === searchDigits);
  });

  if (matches.length === 1) return { id: matches[0].id };

  if (matches.length > 1) {
    logger.warn(`Ambiguous phone match for ${phoneE164}: ${matches.length} contacts found, skipping`);
    return null;
  }

  return null;
}

/**
 * Create a HubSpot communication for a WhatsApp message.
 * Returns communication ID if created, null if no match found.
 */
async function sendWhatsAppToHubSpot(
  messageRecord: Record<string, unknown>,
  contactPhoneE164: string,
  hubspotOwnerId: string | null
): Promise<string | null> {
  if (!hubspotOwnerId) {
    logger.debug("No HubSpot owner, skipping");
    return null;
  }

  const contact = await findHubSpotContactByPhone(contactPhoneE164);
  if (!contact) {
    logger.debug(`No HubSpot contact for phone ${contactPhoneE164}`);
    return null;
  }

  const direction = messageRecord.is_sender ? "Outbound" : "Inbound";
  const communicationBody = `${direction}: ${messageRecord.text}`;

  // Get associated deals
  let validDeals: string[] = [];
  try {
    const dealsResponse = await callHubSpot(
      `${HUBSPOT_API_BASE}/crm/v4/objects/contacts/${contact.id}/associations/deals`,
      "GET"
    );
    await sleep(BETWEEN_HUBSPOT_CALLS);

    const dealResults = (dealsResponse.results ?? []) as { toObjectId?: string; id?: string }[];
    const dealIds = dealResults.map((r) => r.toObjectId ?? r.id ?? "").filter(Boolean);

    // Validate deals exist
    for (const dealId of dealIds) {
      try {
        await callHubSpot(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=dealname`, "GET");
        validDeals.push(dealId);
      } catch {
        logger.warn(`Deal ${dealId} not valid for contact ${contact.id}, skipping`);
      }
      await sleep(BETWEEN_HUBSPOT_CALLS);
    }
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to fetch deals for contact ${contact.id}: ${m}`);
  }

  // Build associations
  const contactAssociation = {
    to: { id: contact.id },
    types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 81 }],
  };

  const associations: Record<string, unknown>[] = [contactAssociation];
  for (const dealId of validDeals) {
    associations.push({
      to: { id: dealId },
      types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 87 }],
    });
  }

  const commPayload = {
    properties: {
      hs_communication_channel_type: "WHATS_APP",
      hs_communication_logged_from: "CRM",
      hs_communication_body: communicationBody,
      hs_timestamp: messageRecord.message_date,
      hubspot_owner_id: hubspotOwnerId,
    },
    associations,
  };

  let response;
  try {
    response = await callHubSpot(
      `${HUBSPOT_API_BASE}/crm/v3/objects/communications`,
      "POST",
      commPayload
    );
  } catch (err) {
    const em = err instanceof Error ? err.message : String(err);
    if (em.includes("associations are not valid") && validDeals.length > 0) {
      logger.warn(`Retrying without deal associations for message ${messageRecord.id}`);
      response = await callHubSpot(
        `${HUBSPOT_API_BASE}/crm/v3/objects/communications`,
        "POST",
        { ...commPayload, associations: [contactAssociation] }
      );
    } else {
      throw new Error(`Communication POST failed: ${em}`);
    }
  }

  const hsId = response.id as string | undefined;
  if (hsId) {
    logger.info(`HubSpot communication created: ${hsId} (${direction}) for WA message ${messageRecord.id}`);
  }
  await sleep(BETWEEN_HUBSPOT_CALLS);
  return hsId ?? null;
}

// ============================================
// UTILITIES
// ============================================
function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
