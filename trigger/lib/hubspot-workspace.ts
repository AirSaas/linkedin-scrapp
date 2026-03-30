import { logger } from "@trigger.dev/sdk/v3";
import { callHubSpot } from "./hubspot.js";
import { sleep } from "./utils.js";

// ============================================
// CONSTANTS
// ============================================

const HUBSPOT_API_BASE = "https://api.hubapi.com";
const BETWEEN_CALLS = 150;
const BATCH_SIZE = 100;

export const WORKSPACE_TYPE_ID = "2-44514393";
const CONTACT_TYPE_ID = "0-1";
export const COMMUNICATION_TYPE_ID = "0-18";

export const ACTIVITY_TYPES: Record<string, string> = {
  notes: "0-46",
  emails: "0-49",
  calls: "0-48",
  meetings: "0-47",
  tasks: "0-27",
};

export const EXCLUDED_EMAIL_DOMAINS = [
  "@airsaas.io",
  "@tbap.eu",
  "@qonto.com",
  "@inbox.qonto.com",
  "@altioras.fr",
];

export const EXCLUDED_CONTACT_EMAILS = [
  "thibaut.gautier@tgcc.fr",
];

// ============================================
// TYPES
// ============================================

export interface ActivityRecord {
  id: string;
  typeId: string;
  contactIds: string[];
}

export interface AssociationPair {
  fromId: string;
  toId: string;
}

// ============================================
// SEARCH ACTIVITIES
// ============================================

/**
 * Search HubSpot activities modified since `sinceMs` (epoch ms).
 * Returns activity IDs only — contact associations are resolved separately via batch.
 */
export async function searchActivitiesSince(
  objectSlug: string,
  sinceMs: number
): Promise<string[]> {
  const ids: string[] = [];
  let after: string | undefined;

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_lastmodifieddate",
              operator: "GTE",
              value: String(sinceMs),
            },
          ],
        },
      ],
      properties: ["hs_lastmodifieddate"],
      sorts: ["-hs_lastmodifieddate"],
      limit: 100,
      ...(after ? { after } : {}),
    };

    const resp = await callHubSpot(
      `${HUBSPOT_API_BASE}/crm/v3/objects/${objectSlug}/search`,
      "POST",
      body
    );
    await sleep(BETWEEN_CALLS);

    const results = (resp.results ?? []) as { id: string }[];
    for (const item of results) {
      if (item.id) ids.push(String(item.id));
    }

    const paging = resp.paging as
      | { next?: { after?: string } }
      | undefined;
    after = paging?.next?.after;
  } while (after);

  return ids;
}

// ============================================
// BATCH ASSOCIATIONS READ
// ============================================

/**
 * Batch read associations FROM a list of object IDs TO a target type.
 * Returns Map<fromId, toObjectId[]>.
 */
export async function batchReadAssociations(
  fromTypeId: string,
  toTypeId: string,
  fromIds: string[]
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();

  for (let i = 0; i < fromIds.length; i += BATCH_SIZE) {
    const chunk = fromIds.slice(i, i + BATCH_SIZE);

    const resp = await callHubSpot(
      `${HUBSPOT_API_BASE}/crm/v4/associations/${fromTypeId}/${toTypeId}/batch/read`,
      "POST",
      { inputs: chunk.map((id) => ({ id })) }
    );
    await sleep(BETWEEN_CALLS);

    const rows = (resp.results ?? []) as {
      from: { id: string };
      to: { toObjectId: number }[];
    }[];

    for (const row of rows) {
      const fromId = String(row.from.id);
      const toIds = (row.to ?? []).map((t) => String(t.toObjectId));
      if (toIds.length > 0) {
        const existing = result.get(fromId) ?? [];
        result.set(fromId, [...existing, ...toIds]);
      }
    }
  }

  return result;
}

/**
 * Get all activity IDs and their contact associations for a batch of activity IDs.
 * Wrapper around batchReadAssociations for activity→contact direction.
 */
export async function batchGetActivityContacts(
  activityTypeId: string,
  activityIds: string[]
): Promise<Map<string, string[]>> {
  return batchReadAssociations(activityTypeId, CONTACT_TYPE_ID, activityIds);
}

/**
 * Batch get workspace IDs for a list of contact IDs.
 */
export async function batchGetContactWorkspaces(
  contactIds: string[]
): Promise<Map<string, string[]>> {
  return batchReadAssociations(
    CONTACT_TYPE_ID,
    WORKSPACE_TYPE_ID,
    contactIds
  );
}

// ============================================
// BATCH CONTACT EMAILS
// ============================================

/**
 * Batch fetch emails for a list of contact IDs.
 * Returns Map<contactId, email | null>.
 */
export async function batchFetchContactEmails(
  contactIds: string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const unique = [...new Set(contactIds)];

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const chunk = unique.slice(i, i + BATCH_SIZE);

    try {
      const resp = await callHubSpot(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/read`,
        "POST",
        {
          inputs: chunk.map((id) => ({ id })),
          properties: ["email"],
        }
      );
      await sleep(BETWEEN_CALLS);

      const items = (resp.results ?? []) as {
        id: string;
        properties?: { email?: string };
      }[];

      const fetched = new Set<string>();
      for (const item of items) {
        const id = String(item.id);
        const email = item.properties?.email?.toLowerCase() ?? null;
        result.set(id, email);
        fetched.add(id);
      }

      // Contacts not returned = no email
      for (const id of chunk) {
        if (!fetched.has(id)) result.set(id, null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`batchFetchContactEmails chunk failed: ${msg}`);
      for (const id of chunk) result.set(id, null);
    }
  }

  return result;
}

/**
 * Filter out internal contacts (email domain in EXCLUDED_EMAIL_DOMAINS).
 * Returns the set of external contact IDs.
 */
export function filterExternalContacts(
  emailMap: Map<string, string | null>
): Set<string> {
  const external = new Set<string>();

  for (const [contactId, email] of emailMap) {
    if (!email) {
      // No email = consider external (sync it)
      external.add(contactId);
      continue;
    }

    const emailLower = email.toLowerCase();

    const isInternal = EXCLUDED_EMAIL_DOMAINS.some((domain) =>
      emailLower.endsWith(domain)
    );
    const isExcluded = EXCLUDED_CONTACT_EMAILS.some(
      (e) => emailLower === e.toLowerCase()
    );

    if (!isInternal && !isExcluded) {
      external.add(contactId);
    }
  }

  return external;
}

// ============================================
// BATCH CREATE / DELETE ASSOCIATIONS
// ============================================

/**
 * Check which activity IDs are already associated with a given workspace.
 * Returns Set of already-linked activity IDs.
 */
export async function batchCheckExistingAssociations(
  activityTypeId: string,
  activityIds: string[],
  workspaceId: string
): Promise<Set<string>> {
  const assocMap = await batchReadAssociations(
    activityTypeId,
    WORKSPACE_TYPE_ID,
    activityIds
  );

  const already = new Set<string>();
  for (const [fromId, toIds] of assocMap) {
    if (toIds.includes(workspaceId)) {
      already.add(fromId);
    }
  }

  return already;
}

/**
 * Batch create associations activity→workspace.
 * Returns count of created associations.
 */
export async function batchCreateAssociations(
  activityTypeId: string,
  pairs: AssociationPair[]
): Promise<number> {
  if (pairs.length === 0) return 0;
  let created = 0;

  // HubSpot batch limit is ~1000, use 800 to be safe
  const CHUNK = 800;
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK);

    try {
      await callHubSpot(
        `${HUBSPOT_API_BASE}/crm/v4/associations/${activityTypeId}/${WORKSPACE_TYPE_ID}/batch/associate/default`,
        "POST",
        {
          inputs: chunk.map((p) => ({
            from: { id: p.fromId },
            to: { id: p.toId },
          })),
        }
      );
      created += chunk.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        `batchCreateAssociations failed (${activityTypeId}): ${msg}`
      );
    }
    await sleep(BETWEEN_CALLS);
  }

  return created;
}

/**
 * Batch delete associations activity→workspace.
 * Returns count of deleted associations.
 */
export async function batchDeleteAssociations(
  activityTypeId: string,
  pairs: AssociationPair[]
): Promise<number> {
  if (pairs.length === 0) return 0;
  let deleted = 0;

  const CHUNK = 800;
  for (let i = 0; i < pairs.length; i += CHUNK) {
    const chunk = pairs.slice(i, i + CHUNK);

    try {
      await callHubSpot(
        `${HUBSPOT_API_BASE}/crm/v4/associations/${activityTypeId}/${WORKSPACE_TYPE_ID}/batch/archive`,
        "POST",
        {
          inputs: chunk.map((p) => ({
            from: { id: p.fromId },
            to: [{ id: p.toId }],
          })),
        }
      );
      deleted += chunk.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(
        `batchDeleteAssociations failed (${activityTypeId}): ${msg}`
      );
    }
    await sleep(BETWEEN_CALLS);
  }

  return deleted;
}

// ============================================
// PAGINATED SINGLE-OBJECT ASSOCIATIONS
// ============================================

/**
 * Get all associated IDs from a single object (paginated).
 * Used for backfill: get all activities/contacts linked to a workspace.
 */
export async function getAllAssociatedIds(
  fromTypeId: string,
  fromId: string,
  toTypeId: string
): Promise<string[]> {
  const out: string[] = [];
  let after: string | undefined;

  do {
    const url = `${HUBSPOT_API_BASE}/crm/v4/objects/${fromTypeId}/${fromId}/associations/${toTypeId}${after ? `?after=${after}` : ""}`;
    const resp = await callHubSpot(url, "GET");
    await sleep(BETWEEN_CALLS);

    const items = (resp.results ?? []) as {
      toObjectId?: number;
      id?: number;
    }[];
    for (const it of items) {
      const id = it.toObjectId ?? it.id;
      if (id != null) out.push(String(id));
    }

    const paging = resp.paging as
      | { next?: { after?: string } }
      | undefined;
    after = paging?.next?.after;
  } while (after);

  return [...new Set(out)];
}

// ============================================
// SLACK NOTIFICATION
// ============================================

/**
 * Send a notification to the dedicated workspace sync Slack webhook.
 */
export async function sendWorkspaceSlackNotification(
  message: string
): Promise<void> {
  const webhook = process.env.SLACK_WEBHOOK_SYNC_WORKSPACE;
  if (!webhook) {
    logger.warn("SLACK_WEBHOOK_SYNC_WORKSPACE not configured, skipping");
    return;
  }

  try {
    const resp = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    if (!resp.ok) {
      logger.warn(`Slack webhook error: ${resp.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Slack webhook exception: ${msg}`);
  }
}
