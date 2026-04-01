import { logger } from "@trigger.dev/sdk/v3";
import { sleep } from "./utils.js";
import {
  batchGetContactWorkspaces,
  batchCreateAssociations,
  COMMUNICATION_TYPE_ID,
} from "./hubspot-workspace.js";

const HUBSPOT_API_BASE = "https://api.hubapi.com";
const HUBSPOT_429_PAUSE = 10000;
const BETWEEN_HUBSPOT_CALLS = 150;

export async function callHubSpot(
  url: string,
  method: string,
  payload?: unknown,
  retries = 2
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

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoff = attempt === 1 ? 2000 : 5000;
      logger.warn(`HubSpot retry ${attempt}/${retries}, waiting ${backoff}ms`);
      await sleep(backoff);
    }

    const res = await fetch(url, options);

    if (res.status === 429) {
      logger.warn("HubSpot rate limit 429, pausing 10s...");
      await sleep(HUBSPOT_429_PAUSE);
      continue;
    }

    // Retry on transient 5xx (502, 503, 504...)
    if (res.status >= 500 && attempt < retries) {
      const text = await res.text();
      logger.warn(`HubSpot ${res.status}, retrying: ${text.substring(0, 200)}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.substring(0, 300)}`);
    }

    const text = await res.text();
    return text.length > 0 ? JSON.parse(text) : {};
  }

  throw new Error(`HubSpot call failed after ${retries} retries`);
}

export async function findHubSpotContact(
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

export async function findHubSpotContactByEmail(
  email: string
): Promise<{ id: string } | null> {
  const response = await callHubSpot(
    `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
    "POST",
    {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "email",
              operator: "EQ",
              value: email,
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

export async function getContactDeals(
  contactId: string
): Promise<string[]> {
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

/**
 * Create a HubSpot communication for a LinkedIn message.
 * Returns the communication ID if created, null if skipped (no owner or no contact found).
 */
export async function sendMessageToHubSpot(
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

  let contact;
  try {
    contact = await findHubSpotContact(mainParticipantId);
  } catch (err) {
    const em = err instanceof Error ? err.message : String(err);
    throw new Error(`Contact search failed: ${em}`);
  }
  await sleep(BETWEEN_HUBSPOT_CALLS);

  if (!contact) {
    logger.debug(`No HubSpot contact for ${mainParticipantId}`);
    return null;
  }

  const direction =
    messageRecord.sender_id === ownerUrn ? "Outbound" : "Inbound";
  const communicationBody = `${direction}: ${messageRecord.text}`;

  const contactDeals = await getContactDeals(contact.id);
  await sleep(BETWEEN_HUBSPOT_CALLS);

  // Validate deals exist before associating (stale/archived deals cause HTTP 400)
  const validDeals: string[] = [];
  for (const dealId of contactDeals) {
    try {
      await callHubSpot(
        `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=dealname`,
        "GET"
      );
      validDeals.push(dealId);
    } catch {
      logger.warn(
        `Deal ${dealId} not valid for contact ${contact.id}, skipping`
      );
    }
    await sleep(BETWEEN_HUBSPOT_CALLS);
  }

  const contactAssociation = {
    to: { id: contact.id },
    types: [
      { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 81 },
    ],
  };

  const associations: Record<string, unknown>[] = [contactAssociation];
  for (const dealId of validDeals) {
    associations.push({
      to: { id: dealId },
      types: [
        { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 87 },
      ],
    });
  }

  const commPayload = {
    properties: {
      hs_communication_channel_type: "LINKEDIN_MESSAGE",
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
    // Fallback: retry without deal associations if they caused the failure
    if (em.includes("associations are not valid") && validDeals.length > 0) {
      logger.warn(
        `Retrying without deal associations for message ${messageRecord.id}`
      );
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
    logger.info(
      `HubSpot communication created: ${hsId} (${direction}) for message ${messageRecord.id}`
    );
  }
  await sleep(BETWEEN_HUBSPOT_CALLS);
  return hsId ?? null;
}

/**
 * Create a HubSpot communication for a Crisp support chat message.
 * Associates to contact + workspace(s). Returns communication ID or null.
 */
export async function sendCrispMessageToHubSpot(params: {
  content: string;
  timestamp: string;
  direction: "INBOUND" | "OUTBOUND";
  contactId: string;
  hubspotOwnerId?: string | null;
}): Promise<string | null> {
  const { content, timestamp, direction, contactId, hubspotOwnerId } = params;

  const directionLabel = direction === "INBOUND" ? "Inbound" : "Outbound";
  const communicationBody = `[tchat_support] ${directionLabel}: ${content}`;

  const contactAssociation = {
    to: { id: contactId },
    types: [
      { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 81 },
    ],
  };

  const properties: Record<string, string> = {
    hs_communication_channel_type: "CUSTOM_CHANNEL_CONVERSATION",
    hs_communication_logged_from: "CRM",
    hs_communication_body: communicationBody,
    hs_timestamp: timestamp,
  };
  if (hubspotOwnerId) {
    properties.hubspot_owner_id = hubspotOwnerId;
  }

  const response = await callHubSpot(
    `${HUBSPOT_API_BASE}/crm/v3/objects/communications`,
    "POST",
    { properties, associations: [contactAssociation] }
  );
  await sleep(BETWEEN_HUBSPOT_CALLS);

  const hsId = response.id as string | undefined;
  if (!hsId) return null;

  logger.info(
    `HubSpot CUSTOM_CHANNEL created: ${hsId} (${directionLabel}) for contact ${contactId}`
  );

  // Associate communication → workspace(s) via contact's workspaces
  try {
    const contactWorkspaces = await batchGetContactWorkspaces([contactId]);
    const wsIds = contactWorkspaces.get(contactId) ?? [];

    if (wsIds.length > 0) {
      const pairs = wsIds.map((wsId) => ({ fromId: hsId, toId: wsId }));
      await batchCreateAssociations(COMMUNICATION_TYPE_ID, pairs);
      logger.info(`  → associated to ${wsIds.length} workspace(s)`);
    }
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    logger.warn(`Workspace association failed for comm ${hsId}: ${m}`);
  }

  return hsId;
}
