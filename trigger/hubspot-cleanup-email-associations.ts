import { logger, schedules } from "@trigger.dev/sdk/v3";
import { sleep } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const HUBSPOT_API_BASE = "https://api.hubapi.com";

// Only process emails associated with more than X contacts
const MIN_CONTACTS_THRESHOLD = 3;

// Internal domains — never dissociate these
const INTERNAL_DOMAINS = ["airsaas.io"];

const RATE_LIMIT = {
  PAUSE_BETWEEN_API_CALLS: 150,
  PAUSE_RATE_LIMIT_429: 10000,
};

// ============================================
// TYPES
// ============================================
interface HubSpotEmail {
  id: string;
  properties: {
    hs_email_subject?: string;
    hs_email_from_email?: string;
    hs_email_to_email?: string;
    hs_email_cc_email?: string;
    hs_email_bcc_email?: string;
  };
}

interface HubSpotContact {
  id: string;
  properties?: {
    email?: string;
    firstname?: string;
    lastname?: string;
    hs_additional_emails?: string;
  };
}

// ============================================
// SCHEDULED TASK
// ============================================
export const hubspotCleanupEmailAssociationsTask = schedules.task({
  id: "hubspot-cleanup-email-associations",
  maxDuration: 600,
  run: async () => {
    logger.info("=== START hubspot-cleanup-email-associations ===");

    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    logger.info(`Scanning emails since ${cutoffDate.toISOString()}`);

    // 1. Get recent emails
    const emails = await getRecentEmails(cutoffDate);
    logger.info(`${emails.length} emails found`);

    let emailsWithIssues = 0;
    let associationsRemoved = 0;
    let errors = 0;

    // 2. Process each email
    for (const email of emails) {
      const emailId = email.id;
      const subject =
        email.properties.hs_email_subject || "(no subject)";
      const from = (
        email.properties.hs_email_from_email ?? ""
      ).toLowerCase();
      const to = (
        email.properties.hs_email_to_email ?? ""
      ).toLowerCase();
      const cc = (
        email.properties.hs_email_cc_email ?? ""
      ).toLowerCase();
      const bcc = (
        email.properties.hs_email_bcc_email ?? ""
      ).toLowerCase();

      const involvedEmails = extractEmails(
        `${from};${to};${cc};${bcc}`
      );

      // Get associated contacts
      const contacts = await getAssociatedContacts(emailId);
      if (contacts.length <= MIN_CONTACTS_THRESHOLD) continue;

      let removedCount = 0;

      for (const contact of contacts) {
        const contactEmail = (
          contact.properties?.email ?? ""
        ).toLowerCase();
        const additionalEmails = (
          contact.properties?.hs_additional_emails ?? ""
        ).toLowerCase();
        const allContactEmails = extractEmails(
          `${contactEmail};${additionalEmails}`
        );

        if (allContactEmails.size === 0) continue;

        // Skip internal domains
        if (
          INTERNAL_DOMAINS.some((d) =>
            [...allContactEmails].some((e) => e.endsWith(`@${d}`))
          )
        )
          continue;

        const isInvolved = [...allContactEmails].some((ce) =>
          involvedEmails.has(ce)
        );

        if (!isInvolved) {
          const contactName =
            `${contact.properties?.firstname ?? ""} ${contact.properties?.lastname ?? ""}`.trim();

          try {
            await removeAssociation(emailId, contact.id);
            await sleep(RATE_LIMIT.PAUSE_BETWEEN_API_CALLS);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(
              `Error removing association ${contact.id}: ${msg}`
            );
            errors++;
            continue;
          }

          removedCount++;
          associationsRemoved++;
          logger.debug(
            `Removed: ${contactName} <${[...allContactEmails].join(", ")}> from email ${emailId}`
          );
        }
      }

      if (removedCount > 0) {
        emailsWithIssues++;
        logger.info(
          `[${emailId}] "${subject.substring(0, 60)}" — ${removedCount} parasites / ${contacts.length} contacts`
        );
      }
    }

    const summary = {
      success: true,
      emailsScanned: emails.length,
      emailsWithIssues,
      associationsRemoved,
      errors,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// HUBSPOT API HELPERS
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
    logger.warn("Rate limit 429, pausing 10s...");
    await sleep(RATE_LIMIT.PAUSE_RATE_LIMIT_429);
    return callHubSpot(url, method, payload);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.substring(0, 300)}`);
  }

  const text = await res.text();
  return text.length > 0 ? JSON.parse(text) : {};
}

async function getRecentEmails(sinceDate: Date): Promise<HubSpotEmail[]> {
  const allEmails: HubSpotEmail[] = [];
  let after: string | null = null;

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_createdate",
              operator: "GTE",
              value: String(sinceDate.getTime()),
            },
          ],
        },
      ],
      properties: [
        "hs_email_subject",
        "hs_email_from_email",
        "hs_email_to_email",
        "hs_email_cc_email",
        "hs_email_bcc_email",
      ],
      sorts: [
        { propertyName: "hs_createdate", direction: "DESCENDING" },
      ],
      limit: 100,
    };

    if (after) {
      body.after = after;
    }

    const response = await callHubSpot(
      `${HUBSPOT_API_BASE}/crm/v3/objects/emails/search`,
      "POST",
      body
    );

    const results = (response.results ?? []) as HubSpotEmail[];
    allEmails.push(...results);

    const paging = response.paging as
      | { next?: { after?: string } }
      | undefined;
    after = paging?.next?.after ?? null;

    await sleep(100);
  } while (after);

  return allEmails;
}

async function getAssociatedContacts(
  emailId: string
): Promise<HubSpotContact[]> {
  const contactIds: string[] = [];
  let after: string | null = null;

  do {
    let url = `${HUBSPOT_API_BASE}/crm/v4/objects/emails/${emailId}/associations/contacts?limit=500`;
    if (after) url += `&after=${after}`;

    const response = await callHubSpot(url, "GET");
    const results = (response.results ?? []) as {
      toObjectId: string;
    }[];
    contactIds.push(...results.map((r) => r.toObjectId));

    const paging = response.paging as
      | { next?: { after?: string } }
      | undefined;
    after = paging?.next?.after ?? null;
  } while (after);

  if (contactIds.length === 0) return [];

  // Batch read contacts (max 100 per batch)
  const contacts: HubSpotContact[] = [];
  for (let i = 0; i < contactIds.length; i += 100) {
    const batch = contactIds.slice(i, i + 100);

    const response = await callHubSpot(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/read`,
      "POST",
      {
        inputs: batch.map((id) => ({ id: String(id) })),
        properties: [
          "email",
          "firstname",
          "lastname",
          "hs_additional_emails",
        ],
      }
    );

    const results = (response.results ?? []) as HubSpotContact[];
    contacts.push(...results);
    await sleep(100);
  }

  return contacts;
}

async function removeAssociation(
  emailId: string,
  contactId: string
): Promise<void> {
  await callHubSpot(
    `${HUBSPOT_API_BASE}/crm/v4/objects/emails/${emailId}/associations/contacts/${contactId}`,
    "DELETE"
  );
}

// ============================================
// UTILITY
// ============================================
function extractEmails(str: string): Set<string> {
  const emails = new Set<string>();
  for (const part of str.split(/[;,\s]+/)) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed.includes("@")) emails.add(trimmed);
  }
  return emails;
}
