import { logger, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "./lib/supabase.js";
import { sleep } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const RATE_LIMIT = {
  PAUSE_BETWEEN_EVENTS: 100,
  PAUSE_BETWEEN_API_CALLS: 200,
};

const LGM_API_URL = "https://apiv2.lagrowthmachine.com/flow/leads";
const HUBSPOT_API_BASE = "https://api.hubapi.com";
const HUBSPOT_CONTACT_BASE_URL =
  "https://app.hubspot.com/contacts/7979190/record/0-1";
const BERTRAN_HUBSPOT_OWNER_ID = "48901672";
const SLACK_CHANNEL_LOGERROR_ID = "C0AAXKPRKT8";

const EXCLUDED_LINKEDIN_PROFILES = [
  "https://www.linkedin.com/in/stephan-boisson-3ba61950/",
  "https://www.linkedin.com/in/benitodiz/",
];

// Mapping: owner|eventType|connected_status → action
// "HUBSPOT" = update HubSpot, string = LGM audience, null = skip
const AUDIENCE_MAPPING: Record<string, string | null> = {
  // THOMAS_POITAU
  "thomas_poitau|Reaction|connected_false":
    "thomas_poitau_warm_leads_connected_false_q1_2025",
  "thomas_poitau|Comment|connected_false":
    "thomas_poitau_warm_leads_connected_false_q1_2025",
  "thomas_poitau|Visit Profile|connected_false":
    "thomas_poitau_warm_leads_connected_false_q1_2025",
  "thomas_poitau|Follow Team Member|connected_false":
    "thomas_poitau_warm_leads_connected_false_q1_2025",
  "thomas_poitau|Reaction|connected_true": "HUBSPOT",
  "thomas_poitau|Comment|connected_true": "HUBSPOT",
  "thomas_poitau|Visit Profile|connected_true": "HUBSPOT",
  "thomas_poitau|Follow Team Member|connected_true": "HUBSPOT",
  "thomas_poitau|Connect|connected_false": null,
  "thomas_poitau|Connect|connected_true": null,

  // BERTRAN_RUIZ
  "bertran_ruiz|Reaction|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q1_2025",
  "bertran_ruiz|Comment|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q1_2025",
  "bertran_ruiz|Visit Profile|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q1_2025",
  "bertran_ruiz|Follow Team Member|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q1_2025",
  "bertran_ruiz|Reaction|connected_true": "HUBSPOT",
  "bertran_ruiz|Comment|connected_true": "HUBSPOT",
  "bertran_ruiz|Visit Profile|connected_true": "HUBSPOT",
  "bertran_ruiz|Follow Team Member|connected_true": "HUBSPOT",
  "bertran_ruiz|Connect|connected_false": null,
  "bertran_ruiz|Connect|connected_true": null,

  // SIMON_VACHER
  "simon_vacher|Reaction|connected_false":
    "simon_vacher_warm_leads_connected_false_q1_2025",
  "simon_vacher|Comment|connected_false":
    "simon_vacher_warm_leads_connected_false_q1_2025",
  "simon_vacher|Visit Profile|connected_false":
    "simon_vacher_warm_leads_connected_false_q1_2025",
  "simon_vacher|Follow Team Member|connected_false":
    "simon_vacher_warm_leads_connected_false_q1_2025",
  "simon_vacher|Reaction|connected_true": "HUBSPOT",
  "simon_vacher|Comment|connected_true": "HUBSPOT",
  "simon_vacher|Visit Profile|connected_true": "HUBSPOT",
  "simon_vacher|Follow Team Member|connected_true": "HUBSPOT",
  "simon_vacher|Connect|connected_false": null,
  "simon_vacher|Connect|connected_true": null,

  // AIRSAAS (page)
  "airsaas|Follow Page|connected_false": "airsaas_follow_page_q1_2025",
  "airsaas|Follow Page|connected_true": "airsaas_follow_page_q1_2025",

  // PRODELATRANSFO (page)
  "prodelatransfo|Follow Page|connected_false":
    "prodelatransfo_follow_page_q1_2025",
  "prodelatransfo|Follow Page|connected_true":
    "prodelatransfo_follow_page_q1_2025",
};

// Mapping sales_nav_source → LGM audience for concurrent contacts
const CONCURRENT_LGM_AUDIENCES: Record<string, string> = {
  "sales-nav-1": "bertran_ruiz_concurrent_adrien_cousa_abraxio",
  "sales-nav-2": "bertran_ruiz_concurrent_laurent_defer_triskell",
};

// ============================================
// TYPES
// ============================================
interface IntentEvent {
  CONTACT_FIRST_NAME?: string;
  CONTACT_LAST_NAME?: string;
  CONTACT_LINKEDIN_PROFILE_URL?: string;
  COMPANY_NAME?: string;
  CONTACT_JOB?: string;
  CONTACT_LOCATION?: string;
  CONTACT_HUBSPOT_ID?: string;
  BUSINESS_OWNER?: string;
  INTENT_EVENT_TYPE?: string;
  CONNECTED_WITH_BUSINESS_OWNER?: boolean | string;
  CONTACT_JOB_STRATEGIC_ROLE?: string;
}

interface ConcurrentContact {
  first_name?: string;
  last_name?: string;
  linkedin_profile_url?: string;
  company_name?: string;
  linkedin_job_title?: string;
  location?: string;
  connected_with?: string;
  sales_nav_source?: string;
  job_strategic_role?: string;
}

interface TeamMember {
  hubspot_connected_with_value?: string;
  hubspot_id?: string;
  slack_id?: string;
}

interface ProcessedEvent {
  record: IntentEvent;
  action: string | null;
  shouldSendSlack: boolean;
}

interface UnmappedKeyDetail {
  key: string;
  rawOwner: string;
  example: string;
  eventType: string;
}

// ============================================
// SCHEDULED TASK
// ============================================
export const lgmProcessIntentEventsTask = schedules.task({
  id: "lgm-process-intent-events",
  maxDuration: 600,
  run: async () => {
    logger.info("=== START lgm-process-intent-events ===");

    // 1. Get team members
    const teamMembers = await getWorkspaceTeamMembers();
    logger.info(`${teamMembers.length} team members found`);

    // 2. Process Intent Events
    const intentResult = await processIntentEvents(teamMembers);

    // 3. Process Concurrent Contacts
    const concurrentResult = await processConcurrentContacts(teamMembers);

    // 4. Calculate total errors
    const totalLgmFailed =
      intentResult.lgmFailed + concurrentResult.lgmFailed;
    const totalHubspotFailed =
      intentResult.hubspotFailed +
      concurrentResult.hubspotUpdateFailed +
      concurrentResult.hubspotCreateFailed;
    const totalErrorCount =
      totalLgmFailed +
      totalHubspotFailed +
      intentResult.unmappedKeys.length;

    // 5. Send grouped Slack message (main channel)
    const slackResult = await sendGroupedSlackMessage(
      intentResult.processedEvents,
      teamMembers,
      totalErrorCount
    );

    // 6. Send error alert (logerror channel) if needed
    if (totalErrorCount > 0) {
      const errorDetails: string[] = [];
      if (intentResult.lgmFailed > 0)
        errorDetails.push(
          `Intent Events LGM: ${intentResult.lgmFailed} fails`
        );
      if (intentResult.hubspotFailed > 0)
        errorDetails.push(
          `Intent Events HubSpot: ${intentResult.hubspotFailed} fails`
        );
      if (concurrentResult.lgmFailed > 0)
        errorDetails.push(
          `Concurrent LGM: ${concurrentResult.lgmFailed} fails`
        );
      if (concurrentResult.hubspotUpdateFailed > 0)
        errorDetails.push(
          `Concurrent HubSpot Update: ${concurrentResult.hubspotUpdateFailed} fails`
        );
      if (concurrentResult.hubspotCreateFailed > 0)
        errorDetails.push(
          `Concurrent HubSpot Create: ${concurrentResult.hubspotCreateFailed} fails`
        );
      errorDetails.push(...concurrentResult.errors);

      await sendSlackErrorAlert(
        {
          processed: intentResult.processed + concurrentResult.processed,
          lgmFailed: totalLgmFailed,
          hubspotFailed: totalHubspotFailed,
          slackFailed: slackResult.success ? 0 : 1,
          errors: errorDetails,
        },
        intentResult.unmappedKeys
      );
    }

    const summary = {
      success: true,
      intentEvents: {
        total: intentResult.total,
        processed: intentResult.processed,
        excluded: intentResult.excluded,
        lgmSuccess: intentResult.lgmSuccess,
        lgmFailed: intentResult.lgmFailed,
        hubspotSuccess: intentResult.hubspotSuccess,
        hubspotFailed: intentResult.hubspotFailed,
      },
      concurrentContacts: {
        total: concurrentResult.total,
        processed: concurrentResult.processed,
        excluded: concurrentResult.excluded,
        lgmSuccess: concurrentResult.lgmSuccess,
        lgmFailed: concurrentResult.lgmFailed,
        hubspotUpdateSuccess: concurrentResult.hubspotUpdateSuccess,
        hubspotCreateSuccess: concurrentResult.hubspotCreateSuccess,
      },
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// SUPABASE HELPERS
// ============================================
async function getWorkspaceTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("workspace_team")
    .select("hubspot_connected_with_value, hubspot_id, slack_id")
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to fetch workspace_team: ${error.message}`);
  }
  return (data ?? []) as TeamMember[];
}

async function getYesterdayIntentEvents(): Promise<IntentEvent[]> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  logger.info(`Fetching intent events from ${yesterdayStr}`);

  const { data, error } = await supabase
    .from("PRC_INTENT_EVENTS")
    .select("*")
    .gte("EVENT_RECORDED_ON", yesterdayStr)
    .lt("EVENT_RECORDED_ON", todayStr)
    .not("CONTACT_JOB_STRATEGIC_ROLE", "is", null)
    .neq("CONTACT_JOB_STRATEGIC_ROLE", "");

  if (error) {
    throw new Error(`Failed to fetch PRC_INTENT_EVENTS: ${error.message}`);
  }

  logger.info(`${(data ?? []).length} intent events found`);
  return (data ?? []) as IntentEvent[];
}

async function getYesterdayConcurrentContacts(): Promise<ConcurrentContact[]> {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  logger.info(`Fetching concurrent contacts created on ${yesterdayStr}`);

  const { data, error } = await supabase
    .from("scrapped_strategic_connection_concurrent")
    .select("*")
    .gte("created_at", yesterdayStr)
    .lt("created_at", todayStr)
    .not("job_strategic_role", "is", null);

  if (error) {
    throw new Error(
      `Failed to fetch concurrent contacts: ${error.message}`
    );
  }

  logger.info(`${(data ?? []).length} concurrent contacts found`);
  return (data ?? []) as ConcurrentContact[];
}

async function getHubspotIdFromPrcContacts(
  linkedinProfileUrl: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("PRC_CONTACTS")
    .select("CONTACT_HUBSPOT_ID")
    .eq("CONTACT_LINKEDIN_PROFILE_URL", linkedinProfileUrl)
    .maybeSingle();

  if (error) {
    logger.error(`PRC_CONTACTS lookup error: ${error.message}`);
    return null;
  }

  return (data as { CONTACT_HUBSPOT_ID?: string } | null)
    ?.CONTACT_HUBSPOT_ID ?? null;
}

// ============================================
// LGM HELPERS
// ============================================
function buildIntentEventLgmPayload(
  record: IntentEvent,
  audienceName: string
): Record<string, string> {
  const payload: Record<string, string> = { audience: audienceName };

  const mapping: Record<string, string> = {
    CONTACT_FIRST_NAME: "firstname",
    CONTACT_LAST_NAME: "lastname",
    CONTACT_LINKEDIN_PROFILE_URL: "linkedinUrl",
    COMPANY_NAME: "companyName",
    CONTACT_JOB: "jobTitle",
    CONTACT_LOCATION: "location",
  };

  for (const [sourceField, targetField] of Object.entries(mapping)) {
    const value = (record as Record<string, unknown>)[sourceField];
    if (value !== null && value !== undefined && value !== "") {
      payload[targetField] = String(value);
    }
  }

  return payload;
}

function buildConcurrentLgmPayload(
  record: ConcurrentContact,
  audienceName: string
): Record<string, string> {
  const payload: Record<string, string> = { audience: audienceName };

  const mapping: Record<string, string> = {
    first_name: "firstname",
    last_name: "lastname",
    linkedin_profile_url: "linkedinUrl",
    company_name: "companyName",
    linkedin_job_title: "jobTitle",
    location: "location",
  };

  for (const [sourceField, targetField] of Object.entries(mapping)) {
    const value = (record as Record<string, unknown>)[sourceField];
    if (value !== null && value !== undefined && value !== "") {
      payload[targetField] = String(value);
    }
  }

  return payload;
}

async function sendToLgm(
  payload: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.LGM_API_KEY ?? "";
  const url = `${LGM_API_URL}?apikey=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      logger.info(
        `LGM OK - Audience: ${payload.audience}, Lead: ${payload.firstname} ${payload.lastname}`
      );
      return { success: true };
    } else {
      const text = await res.text();
      logger.error(`LGM error ${res.status}: ${text}`);
      return { success: false, error: `${res.status} — ${text}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`LGM exception: ${msg}`);
    return { success: false, error: msg };
  }
}

// ============================================
// HUBSPOT HELPERS
// ============================================
async function getHubspotContactCancelStatus(
  contactHubspotId: string
): Promise<{ success: boolean; cancelValue: string | null }> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN ?? "";
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactHubspotId}?properties=cancel_agent_ia_activated`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.ok) {
      const data = (await res.json()) as {
        properties?: { cancel_agent_ia_activated?: string };
      };
      const cancelValue =
        data.properties?.cancel_agent_ia_activated ?? null;
      logger.info(
        `HubSpot GET OK - Contact: ${contactHubspotId}, cancel: ${cancelValue || "(empty)"}`
      );
      return { success: true, cancelValue };
    } else {
      const text = await res.text();
      logger.error(`HubSpot GET error ${res.status}: ${text}`);
      return { success: false, cancelValue: null };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`HubSpot GET exception: ${msg}`);
    return { success: false, cancelValue: null };
  }
}

async function updateHubspotContactAgentActivated(
  contactHubspotId: string
): Promise<{ success: boolean }> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN ?? "";
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactHubspotId}`;

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { agent_ia_activated: "true" },
      }),
    });

    if (res.ok) {
      logger.info(
        `HubSpot UPDATE OK - Contact: ${contactHubspotId}, agent_ia_activated: true`
      );
      return { success: true };
    } else {
      const text = await res.text();
      logger.error(`HubSpot UPDATE error ${res.status}: ${text}`);
      return { success: false };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`HubSpot UPDATE exception: ${msg}`);
    return { success: false };
  }
}

async function createHubspotContact(
  record: ConcurrentContact,
  ownerId: string
): Promise<{ success: boolean; contactId?: string }> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN ?? "";
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`;

  const properties: Record<string, string> = {
    agent_ia_activated: "true",
  };
  if (record.first_name) properties.firstname = record.first_name;
  if (record.last_name) properties.lastname = record.last_name;
  if (record.linkedin_job_title)
    properties.jobtitle = record.linkedin_job_title;
  if (record.linkedin_profile_url)
    properties.lgm_linkedinurl = record.linkedin_profile_url;
  if (ownerId) properties.hubspot_owner_id = ownerId;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });

    if (res.ok) {
      const data = (await res.json()) as { id?: string };
      logger.info(`HubSpot CREATE OK - Contact ID: ${data.id}`);
      return { success: true, contactId: data.id };
    } else {
      const text = await res.text();
      logger.error(`HubSpot CREATE error ${res.status}: ${text}`);
      return { success: false };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`HubSpot CREATE exception: ${msg}`);
    return { success: false };
  }
}

// ============================================
// BUSINESS LOGIC - UTILITY
// ============================================
function extractLinkedInSlug(url: string | undefined | null): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function isExcludedProfile(linkedinUrl: string | undefined | null): boolean {
  if (!linkedinUrl) return false;
  const slug = extractLinkedInSlug(linkedinUrl);
  if (!slug) return false;

  return EXCLUDED_LINKEDIN_PROFILES.some((excludedUrl) => {
    const excludedSlug = extractLinkedInSlug(excludedUrl);
    return excludedSlug !== null && excludedSlug === slug;
  });
}

function normalizeBusinessOwner(businessOwner: string | undefined | null): string {
  if (!businessOwner) return "unknown";
  return businessOwner
    .toLowerCase()
    .trim()
    .replace(/[\r\n\t]/g, "")
    .replace(/\s+/g, "_");
}

function buildMappingKey(
  businessOwner: string | undefined,
  eventType: string | undefined,
  connectedWithBusinessOwner: boolean | string | undefined
): string {
  const ownerLower = normalizeBusinessOwner(businessOwner);
  const connectedStatus =
    connectedWithBusinessOwner === true ||
    connectedWithBusinessOwner === "true"
      ? "connected_true"
      : "connected_false";
  return `${ownerLower}|${eventType}|${connectedStatus}`;
}

function getActionForRecord(
  businessOwner: string | undefined,
  eventType: string | undefined,
  connectedWithBusinessOwner: boolean | string | undefined
): { action: string | null; keyExists: boolean; key: string } {
  const key = buildMappingKey(
    businessOwner,
    eventType,
    connectedWithBusinessOwner
  );
  const keyExists = key in AUDIENCE_MAPPING;
  const action = keyExists ? AUDIENCE_MAPPING[key] : null;
  return { action, keyExists, key };
}

function parseConnectedWith(
  connectedWith: string | null | undefined
): string[] {
  if (!connectedWith || connectedWith === "") return [];

  if (connectedWith.startsWith("[")) {
    try {
      const parsed = JSON.parse(connectedWith);
      if (Array.isArray(parsed)) {
        return parsed.map((item: string) =>
          item.toLowerCase().trim().replace(/\s+/g, "_")
        );
      }
    } catch {
      // Not valid JSON, continue with string parsing
    }
  }

  return connectedWith
    .split(",")
    .map((item) => item.toLowerCase().trim().replace(/\s+/g, "_"))
    .filter((item) => item.length > 0);
}

function isConnectedWithBertran(
  connectedWith: string | null | undefined
): boolean {
  const connections = parseConnectedWith(connectedWith);
  return connections.some((connection) => connection.includes("bertran"));
}

// ============================================
// BUSINESS LOGIC - INTENT EVENTS
// ============================================
async function processIntentEvents(teamMembers: TeamMember[]) {
  logger.info("--- Processing Intent Events ---");

  const events = await getYesterdayIntentEvents();

  let processed = 0;
  let excluded = 0;
  let lgmSuccess = 0;
  let lgmSkipped = 0;
  let lgmFailed = 0;
  let hubspotSuccess = 0;
  let hubspotSkipped = 0;
  let hubspotFailed = 0;
  const unmappedKeys: UnmappedKeyDetail[] = [];
  const processedEvents: ProcessedEvent[] = [];

  for (const record of events) {
    const fullName =
      `${record.CONTACT_FIRST_NAME ?? ""} ${record.CONTACT_LAST_NAME ?? ""}`.trim();

    if (isExcludedProfile(record.CONTACT_LINKEDIN_PROFILE_URL)) {
      logger.info(`Excluded: ${fullName}`);
      excluded++;
      continue;
    }

    const { action, keyExists, key } = getActionForRecord(
      record.BUSINESS_OWNER,
      record.INTENT_EVENT_TYPE,
      record.CONNECTED_WITH_BUSINESS_OWNER
    );

    // Track unmapped keys
    if (!keyExists) {
      const rawOwner = record.BUSINESS_OWNER || "(empty)";
      const contactName = fullName || "(unknown)";
      const company = record.COMPANY_NAME || "(unknown company)";

      logger.warn(`Unmapped key: ${key} — ${contactName} @ ${company}`);

      if (!unmappedKeys.find((k) => k.key === key)) {
        unmappedKeys.push({
          key,
          rawOwner,
          example: `${contactName} @ ${company}`,
          eventType: record.INTENT_EVENT_TYPE ?? "",
        });
      }
    }

    let shouldSendSlack = true;

    if (action === "HUBSPOT") {
      // Connected → HubSpot update
      const contactHubspotId = record.CONTACT_HUBSPOT_ID;

      if (!contactHubspotId) {
        logger.info(`HubSpot skip - No CONTACT_HUBSPOT_ID for ${fullName}`);
        hubspotSkipped++;
        shouldSendSlack = false;
      } else {
        const getResult =
          await getHubspotContactCancelStatus(contactHubspotId);

        if (!getResult.success) {
          hubspotFailed++;
          shouldSendSlack = false;
        } else if (
          getResult.cancelValue !== null &&
          getResult.cancelValue !== "" &&
          getResult.cancelValue !== undefined
        ) {
          logger.info(
            `HubSpot skip - cancel_agent_ia_activated non-empty for ${fullName}`
          );
          hubspotSkipped++;
          shouldSendSlack = false;
        } else {
          const updateResult =
            await updateHubspotContactAgentActivated(contactHubspotId);
          if (updateResult.success) {
            hubspotSuccess++;
          } else {
            hubspotFailed++;
          }
          shouldSendSlack = updateResult.success;
        }
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_API_CALLS);
      }
    } else if (action !== null) {
      // Not connected → LGM
      const lgmPayload = buildIntentEventLgmPayload(record, action);
      const lgmResult = await sendToLgm(lgmPayload);

      if (lgmResult.success) {
        lgmSuccess++;
      } else {
        lgmFailed++;
        shouldSendSlack = false;
      }
      await sleep(RATE_LIMIT.PAUSE_BETWEEN_API_CALLS);
    } else {
      // action === null → skip
      lgmSkipped++;
      shouldSendSlack = false;
    }

    processedEvents.push({ record, action, shouldSendSlack });
    processed++;

    await sleep(RATE_LIMIT.PAUSE_BETWEEN_EVENTS);
  }

  logger.info(
    `Intent Events done: ${processed} processed, ${excluded} excluded, ` +
      `LGM ${lgmSuccess}/${lgmFailed}/${lgmSkipped}, ` +
      `HubSpot ${hubspotSuccess}/${hubspotFailed}/${hubspotSkipped}`
  );

  return {
    total: events.length,
    processed,
    excluded,
    lgmSuccess,
    lgmSkipped,
    lgmFailed,
    hubspotSuccess,
    hubspotSkipped,
    hubspotFailed,
    unmappedKeys,
    processedEvents,
  };
}

// ============================================
// BUSINESS LOGIC - CONCURRENT CONTACTS
// ============================================
async function processConcurrentContacts(teamMembers: TeamMember[]) {
  logger.info("--- Processing Concurrent Contacts ---");

  const bertranInfo = getBertranFromTeam(teamMembers);
  logger.info(
    `Bertran - HubSpot Owner ID: ${bertranInfo.hubspotOwnerId}`
  );

  const contacts = await getYesterdayConcurrentContacts();

  let processed = 0;
  let excluded = 0;
  let lgmSuccess = 0;
  let lgmFailed = 0;
  let hubspotUpdateSuccess = 0;
  let hubspotUpdateSkipped = 0;
  let hubspotUpdateFailed = 0;
  let hubspotCreateSuccess = 0;
  let hubspotCreateFailed = 0;
  const errors: string[] = [];

  for (const record of contacts) {
    const fullName =
      `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() ||
      "(unknown)";
    const salesNavSource = record.sales_nav_source ?? "unknown";

    if (isExcludedProfile(record.linkedin_profile_url)) {
      logger.info(`Excluded: ${fullName}`);
      excluded++;
      continue;
    }

    const connectedWithBertran = isConnectedWithBertran(
      record.connected_with
    );

    if (!connectedWithBertran) {
      // Not connected → LGM
      const audience =
        CONCURRENT_LGM_AUDIENCES[salesNavSource] ??
        "bertran_ruiz_concurrent_unknown";
      const lgmPayload = buildConcurrentLgmPayload(record, audience);
      const lgmResult = await sendToLgm(lgmPayload);

      if (lgmResult.success) {
        lgmSuccess++;
      } else {
        lgmFailed++;
        errors.push(`LGM fail: ${fullName}`);
      }
    } else {
      // Connected → HubSpot (update or create)
      const existingHubspotId = await getHubspotIdFromPrcContacts(
        record.linkedin_profile_url ?? ""
      );

      if (existingHubspotId) {
        // Contact exists → update
        const getResult =
          await getHubspotContactCancelStatus(existingHubspotId);

        if (!getResult.success) {
          hubspotUpdateFailed++;
          errors.push(`HubSpot Update fail: ${fullName}`);
        } else if (
          getResult.cancelValue !== null &&
          getResult.cancelValue !== "" &&
          getResult.cancelValue !== undefined
        ) {
          logger.info(
            `HubSpot skip - cancel non-empty for ${fullName}`
          );
          hubspotUpdateSkipped++;
        } else {
          const updateResult =
            await updateHubspotContactAgentActivated(existingHubspotId);
          if (updateResult.success) {
            hubspotUpdateSuccess++;
          } else {
            hubspotUpdateFailed++;
            errors.push(`HubSpot Update fail: ${fullName}`);
          }
        }
      } else {
        // Contact doesn't exist → create
        const createResult = await createHubspotContact(
          record,
          bertranInfo.hubspotOwnerId
        );
        if (createResult.success) {
          hubspotCreateSuccess++;
        } else {
          hubspotCreateFailed++;
          errors.push(`HubSpot Create fail: ${fullName}`);
        }
      }
    }

    processed++;
    await sleep(RATE_LIMIT.PAUSE_BETWEEN_EVENTS);
  }

  logger.info(
    `Concurrent Contacts done: ${processed} processed, ${excluded} excluded, ` +
      `LGM ${lgmSuccess}/${lgmFailed}, ` +
      `HubSpot Update ${hubspotUpdateSuccess}/${hubspotUpdateSkipped}/${hubspotUpdateFailed}, ` +
      `HubSpot Create ${hubspotCreateSuccess}/${hubspotCreateFailed}`
  );

  return {
    total: contacts.length,
    processed,
    excluded,
    lgmSuccess,
    lgmFailed,
    hubspotUpdateSuccess,
    hubspotUpdateSkipped,
    hubspotUpdateFailed,
    hubspotCreateSuccess,
    hubspotCreateFailed,
    errors,
  };
}

function getBertranFromTeam(teamMembers: TeamMember[]): {
  hubspotOwnerId: string;
  slackId: string | null;
} {
  const bertran = teamMembers.find(
    (m) => m.hubspot_connected_with_value === "bertran_ruiz"
  );

  if (bertran) {
    return {
      hubspotOwnerId: bertran.hubspot_id ?? BERTRAN_HUBSPOT_OWNER_ID,
      slackId: bertran.slack_id ?? null,
    };
  }

  return { hubspotOwnerId: BERTRAN_HUBSPOT_OWNER_ID, slackId: null };
}

// ============================================
// SLACK - GROUPED MESSAGE (MAIN CHANNEL)
// ============================================
function getSlackIdForOwner(
  businessOwner: string | undefined,
  teamMembers: TeamMember[]
): string | null {
  if (!businessOwner) return null;
  const normalizedOwner = normalizeBusinessOwner(businessOwner);

  const member = teamMembers.find(
    (m) =>
      m.hubspot_connected_with_value &&
      normalizeBusinessOwner(m.hubspot_connected_with_value) ===
        normalizedOwner
  );

  return member?.slack_id ?? null;
}

function formatIntentEventLine(record: IntentEvent): string {
  const firstName = record.CONTACT_FIRST_NAME ?? "";
  const lastName = record.CONTACT_LAST_NAME ?? "";
  const fullName = `${firstName} ${lastName}`.trim() || "—";

  const job = record.CONTACT_JOB || null;
  const company = record.COMPANY_NAME || null;
  let jobLine: string;
  if (job && company) {
    jobLine = `${job} @ ${company}`;
  } else if (job) {
    jobLine = job;
  } else if (company) {
    jobLine = `@ ${company}`;
  } else {
    jobLine = "";
  }

  const eventType = record.INTENT_EVENT_TYPE ?? "";
  const connected =
    record.CONNECTED_WITH_BUSINESS_OWNER === true ||
    record.CONNECTED_WITH_BUSINESS_OWNER === "true";
  const connectionStatus = connected
    ? "connected"
    : "not connected";

  let line = `• ${fullName}`;
  if (jobLine) line += ` - ${jobLine}`;
  line += ` (${eventType}, ${connectionStatus})`;

  // Links line
  const linkedinUrl = record.CONTACT_LINKEDIN_PROFILE_URL;
  const hubspotId = record.CONTACT_HUBSPOT_ID;

  let linksLine = "  🔗 ";
  if (linkedinUrl) {
    linksLine += `<${linkedinUrl}|LinkedIn>`;
  }
  if (hubspotId) {
    const hubspotUrl = `${HUBSPOT_CONTACT_BASE_URL}/${hubspotId}`;
    if (linkedinUrl) linksLine += " | ";
    linksLine += `<${hubspotUrl}|HubSpot>`;
  }

  return `${line}\n${linksLine}`;
}

async function sendGroupedSlackMessage(
  processedEvents: ProcessedEvent[],
  teamMembers: TeamMember[],
  errorCount: number
): Promise<{ success: boolean }> {
  const webhookUrl = process.env.webhook_intent_events ?? "";

  const eventsToSend = processedEvents.filter((e) => e.shouldSendSlack);

  if (eventsToSend.length === 0) {
    logger.info("No events to send to Slack");
    return { success: true };
  }

  if (!webhookUrl) {
    logger.warn("webhook_intent_events not set, skipping");
    return { success: true };
  }

  // Group by owner
  const groupedByOwner: Record<
    string,
    { hubspot: IntentEvent[]; lgm: IntentEvent[] }
  > = {};
  const pagesEvents: {
    record: IntentEvent;
    pageName: string;
  }[] = [];

  for (const event of eventsToSend) {
    const normalizedOwner = normalizeBusinessOwner(
      event.record.BUSINESS_OWNER
    );
    const isPage = ["airsaas", "prodelatransfo"].includes(normalizedOwner);

    if (isPage) {
      pagesEvents.push({
        record: event.record,
        pageName: normalizedOwner,
      });
    } else {
      if (!groupedByOwner[normalizedOwner]) {
        groupedByOwner[normalizedOwner] = { hubspot: [], lgm: [] };
      }

      if (event.action === "HUBSPOT") {
        groupedByOwner[normalizedOwner].hubspot.push(event.record);
      } else {
        groupedByOwner[normalizedOwner].lgm.push(event.record);
      }
    }
  }

  // Build message
  let message = "🔔 *Intent Events J-1 — Trigger.dev*\n";

  if (errorCount > 0) {
    message += `⚠️ ${errorCount} error${errorCount > 1 ? "s" : ""} → see details in <#${SLACK_CHANNEL_LOGERROR_ID}|script-logs>\n`;
  }

  // Section per owner (people)
  for (const [owner, events] of Object.entries(groupedByOwner)) {
    const slackId = getSlackIdForOwner(owner, teamMembers);
    let ownerMention: string;
    if (slackId) {
      ownerMention = `<@${slackId}>`;
    } else {
      ownerMention =
        owner.charAt(0).toUpperCase() + owner.slice(1).replace(/_/g, " ");
    }

    message += `\n👤 ${ownerMention}\n`;

    if (events.hubspot.length > 0) {
      message += `→ *HubSpot IA Agent SDR*\n`;
      for (const record of events.hubspot) {
        message += formatIntentEventLine(record) + "\n";
      }
    }

    if (events.lgm.length > 0) {
      message += `→ *LGM*\n`;
      for (const record of events.lgm) {
        message += formatIntentEventLine(record) + "\n";
      }
    }
  }

  // Section Pages
  if (pagesEvents.length > 0) {
    message += `\n📄 *Pages* → LGM\n`;
    for (const event of pagesEvents) {
      const record = event.record;
      const pageName =
        event.pageName === "airsaas" ? "Airsaas" : "ProDeLaTransfo";

      const firstName = record.CONTACT_FIRST_NAME ?? "";
      const lastName = record.CONTACT_LAST_NAME ?? "";
      const fullName = `${firstName} ${lastName}`.trim() || "—";

      const job = record.CONTACT_JOB || null;
      const company = record.COMPANY_NAME || null;
      let jobLine: string;
      if (job && company) {
        jobLine = `${job} @ ${company}`;
      } else if (job) {
        jobLine = job;
      } else if (company) {
        jobLine = `@ ${company}`;
      } else {
        jobLine = "";
      }

      let line = `• ${fullName}`;
      if (jobLine) line += ` - ${jobLine}`;
      line += ` (Follow Page ${pageName})`;

      const linkedinUrl = record.CONTACT_LINKEDIN_PROFILE_URL;
      const hubspotId = record.CONTACT_HUBSPOT_ID;

      let linksLine = "  🔗 ";
      if (linkedinUrl) {
        linksLine += `<${linkedinUrl}|LinkedIn>`;
      }
      if (hubspotId) {
        const hubspotUrl = `${HUBSPOT_CONTACT_BASE_URL}/${hubspotId}`;
        if (linkedinUrl) linksLine += " | ";
        linksLine += `<${hubspotUrl}|HubSpot>`;
      }

      message += `${line}\n${linksLine}\n`;
    }
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    if (res.ok) {
      logger.info(`Slack grouped message sent (${eventsToSend.length} events)`);
      return { success: true };
    } else {
      logger.error(`Slack grouped message error: ${res.status}`);
      return { success: false };
    }
  } catch (err) {
    logger.error("Slack grouped message exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false };
  }
}

// ============================================
// SLACK - ERROR ALERT (LOGERROR CHANNEL)
// ============================================
async function sendSlackErrorAlert(
  summary: {
    processed: number;
    lgmFailed: number;
    hubspotFailed: number;
    slackFailed: number;
    errors: string[];
  },
  unmappedKeys: UnmappedKeyDetail[]
): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";

  if (!webhookUrl) {
    logger.warn("script_logs not set, skipping error alert");
    return;
  }

  let message = `🚨 *Alerte Intent Events Script — Trigger.dev*

⚠️ Des erreurs sont survenues lors du traitement :

📊 *Résumé :*
- Total traités : ${summary.processed}
- LGM Échecs : ${summary.lgmFailed}
- HubSpot Échecs : ${summary.hubspotFailed}
- Slack Échecs : ${summary.slackFailed}`;

  if (unmappedKeys.length > 0) {
    message += `\n\n🔑 *Clés non mappées :*`;
    for (const k of unmappedKeys) {
      message += `\n• \`${k.key}\``;
      message += `\n  → Contact: ${k.example}`;
      message += `\n  → BUSINESS_OWNER brut: \`${k.rawOwner}\``;
    }
  }

  if (summary.errors.length > 0) {
    message += `\n\n❌ *Autres erreurs :*\n${summary.errors
      .slice(0, 10)
      .map((e) => `• ${e}`)
      .join("\n")}`;
  }

  const now = new Date();
  message += `\n\n📅 ${now.toISOString().substring(0, 10)} ${now.toISOString().substring(11, 16)}`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    logger.info("Slack error alert sent to #script-logs");
  } catch (err) {
    logger.error("Failed to send Slack error alert", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
