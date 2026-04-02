import crypto from "node:crypto";
import { logger, metadata, schedules } from "@trigger.dev/sdk/v3";
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
const MIN_EMPLOYEES_FOR_HUBSPOT = 500;

// Slack channels dédiés par sales (intent owner name → channel ID)
// Used by sendSlackIaNotification to route interactive activation messages
const SLACK_IA_CHANNELS: Record<string, string> = {
  "thomas_poitau": "C0A76PH8K09",
  "bertran_ruiz": "C0AB8RV58Q6",
  "simon_vacher": "C0AMQJW0E1F",
};

const EXCLUDED_LINKEDIN_PROFILES = [
  "https://www.linkedin.com/in/stephan-boisson-3ba61950/",
  "https://www.linkedin.com/in/benitodiz/",
  "https://www.linkedin.com/in/bertranruiz/",
];

// Mapping: intent_owner|eventType|connected_status → action
// "HUBSPOT" = update HubSpot, string = LGM audience, null = skip
// Key uses INTENT_OWNER (who received the intent) + CONNECTED_WITH_INTENT_OWNER
const AUDIENCE_MAPPING: Record<string, string | null> = {
  // THOMAS_POITAU
  "thomas_poitau|Reaction|connected_false":
    "thomas_poitau_warm_leads_connected_false_q2_2026",
  "thomas_poitau|Comment|connected_false":
    "thomas_poitau_warm_leads_connected_false_q2_2026",
  "thomas_poitau|Visit Profile|connected_false":
    "thomas_poitau_warm_leads_connected_false_q2_2026",
  "thomas_poitau|Follow Team Member|connected_false":
    "thomas_poitau_warm_leads_connected_false_q2_2026",
  "thomas_poitau|Connect|connected_false":
    "thomas_poitau_warm_leads_connected_false_q2_2026",
  "thomas_poitau|Reaction|connected_true": "HUBSPOT",
  "thomas_poitau|Comment|connected_true": "HUBSPOT",
  "thomas_poitau|Visit Profile|connected_true": "HUBSPOT",
  "thomas_poitau|Follow Team Member|connected_true": "HUBSPOT",
  "thomas_poitau|Connect|connected_true": "HUBSPOT",

  // BERTRAN_RUIZ
  "bertran_ruiz|Reaction|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q2_2026",
  "bertran_ruiz|Comment|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q2_2026",
  "bertran_ruiz|Visit Profile|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q2_2026",
  "bertran_ruiz|Follow Team Member|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q2_2026",
  "bertran_ruiz|Connect|connected_false":
    "bertran_ruiz_warm_leads_connected_false_q2_2026",
  "bertran_ruiz|Reaction|connected_true": "HUBSPOT",
  "bertran_ruiz|Comment|connected_true": "HUBSPOT",
  "bertran_ruiz|Visit Profile|connected_true": "HUBSPOT",
  "bertran_ruiz|Follow Team Member|connected_true": "HUBSPOT",
  "bertran_ruiz|Connect|connected_true": "HUBSPOT",

  // SIMON_VACHER
  "simon_vacher|Reaction|connected_false":
    "simon_vacher_warm_leads_connected_false_q2_2026",
  "simon_vacher|Comment|connected_false":
    "simon_vacher_warm_leads_connected_false_q2_2026",
  "simon_vacher|Visit Profile|connected_false":
    "simon_vacher_warm_leads_connected_false_q2_2026",
  "simon_vacher|Follow Team Member|connected_false":
    "simon_vacher_warm_leads_connected_false_q2_2026",
  "simon_vacher|Connect|connected_false":
    "simon_vacher_warm_leads_connected_false_q2_2026",
  "simon_vacher|Reaction|connected_true": "HUBSPOT",
  "simon_vacher|Comment|connected_true": "HUBSPOT",
  "simon_vacher|Visit Profile|connected_true": "HUBSPOT",
  "simon_vacher|Follow Team Member|connected_true": "HUBSPOT",
  "simon_vacher|Connect|connected_true": "HUBSPOT",
};

// Follow Page → always LGM to page audience (identified by EVENT_RECORD_ORIGIN)
const PAGE_AUDIENCES: Record<string, string> = {
  Airsaas: "airsaas_follow_page_q1_2025",
  ProDeLaTransfo: "prodelatransfo_follow_page_q1_2025",
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
  INTENT_OWNER?: string;
  INTENT_EVENT_TYPE?: string;
  CONNECTED_WITH_BUSINESS_OWNER?: boolean | string;
  CONNECTED_WITH_INTENT_OWNER?: boolean;
  EVENT_RECORD_ORIGIN?: string;
  CONTACT_JOB_STRATEGIC_ROLE?: string;
  COMPANY_APPROX_EMPLOYEE_NB?: number | string | null;
  COMPANY_SIZE_RANGE?: string | null;
}

interface ConcurrentContact {
  linkedin_private_id?: string;
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
    currentRunId = crypto.randomUUID();
    logger.info(`=== START lgm-process-intent-events === runId=${currentRunId}`);

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

      metadata.set("errorCount", totalErrorCount);
      metadata.set(
        "errors",
        errorDetails.map((e) => e.substring(0, 200)).slice(0, 20)
      );
      await metadata.flush();
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
// BACKFILL TASK (10 DAYS)
// ============================================
export const lgmProcessIntentEvents10DaysTask = schedules.task({
  id: "lgm-process-intent-events-10-days",
  maxDuration: 600,
  run: async () => {
    currentRunId = crypto.randomUUID();
    logger.info(`=== START lgm-process-intent-events-10-days (backfill) === runId=${currentRunId}`);

    const lookbackDays = 10;

    // 1. Get team members
    const teamMembers = await getWorkspaceTeamMembers();
    logger.info(`${teamMembers.length} team members found`);

    // 2. Process Intent Events (10 days)
    const intentResult = await processIntentEvents(teamMembers, lookbackDays);

    // 3. Process Concurrent Contacts (10 days)
    const concurrentResult = await processConcurrentContacts(teamMembers, lookbackDays);

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

      metadata.set("errorCount", totalErrorCount);
      metadata.set(
        "errors",
        errorDetails.map((e) => e.substring(0, 200)).slice(0, 20)
      );
      await metadata.flush();
    }

    const summary = {
      success: true,
      lookbackDays,
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

    logger.info("=== SUMMARY (10-day backfill) ===", summary);
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

async function getIntentEvents(lookbackDays = 1): Promise<IntentEvent[]> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - lookbackDays);
  const sinceStr = since.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  logger.info(`Fetching intent events from ${sinceStr} (${lookbackDays} days)`);

  const { data, error } = await supabase
    .from("PRC_INTENT_EVENTS")
    .select("*")
    .gte("EVENT_RECORDED_ON", sinceStr)
    .lt("EVENT_RECORDED_ON", todayStr)
    .not("CONTACT_JOB_STRATEGIC_ROLE", "is", null)
    .neq("CONTACT_JOB_STRATEGIC_ROLE", "");

  if (error) {
    throw new Error(`Failed to fetch PRC_INTENT_EVENTS: ${error.message}`);
  }

  logger.info(`${(data ?? []).length} intent events found`);
  return (data ?? []) as IntentEvent[];
}

async function getConcurrentContacts(lookbackDays = 1): Promise<ConcurrentContact[]> {
  const now = new Date();
  const since = new Date(now);
  since.setDate(since.getDate() - lookbackDays);
  const sinceStr = since.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  logger.info(`Fetching concurrent contacts from ${sinceStr} (${lookbackDays} days)`);

  const { data, error } = await supabase
    .from("scrapped_strategic_connection_concurrent")
    .select("*")
    .gte("created_at", sinceStr)
    .lt("created_at", todayStr)
    .not("job_strategic_role", "is", null);

  if (error) {
    throw new Error(
      `Failed to fetch concurrent contacts: ${error.message}`
    );
  }

  // Dedup by linkedin_private_id: a contact can appear in multiple Sales Nav searches
  const all = (data ?? []) as ConcurrentContact[];
  const seen = new Set<string>();
  const unique = all.filter((c) => {
    const id = c.linkedin_private_id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  logger.info(`${all.length} concurrent contacts found (${unique.length} unique after dedup)`);
  return unique;
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

interface LgmResponse {
  success: boolean;
  error?: string;
  httpStatus?: number;
  message?: string;
  leadId?: string;
}

async function sendToLgm(
  payload: Record<string, string>
): Promise<LgmResponse> {
  const apiKey = process.env.LGM_API_KEY ?? "";
  const url = `${LGM_API_URL}?apikey=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let message: string | undefined;
    let leadId: string | undefined;
    try {
      const json = JSON.parse(text);
      message = json.message ?? json.msg;
      leadId = json.leadId ?? json.lead_id ?? json.id;
    } catch {
      message = text;
    }

    if (res.ok) {
      logger.info(
        `LGM OK - Audience: ${payload.audience}, Lead: ${payload.firstname} ${payload.lastname} — ${message ?? ""}`
      );
      return { success: true, httpStatus: res.status, message, leadId };
    } else {
      logger.error(`LGM error ${res.status}: ${text}`);
      return { success: false, error: `${res.status} — ${text}`, httpStatus: res.status, message };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`LGM exception: ${msg}`);
    return { success: false, error: msg };
  }
}

// ============================================
// AUDIT LOG HELPER
// ============================================
let currentRunId: string | undefined;

interface LogEntry {
  linkedin_url?: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  destination: string;
  source: "intent_event" | "concurrent_contact";
  lgm_http_status?: number;
  lgm_response_msg?: string;
  lgm_lead_id?: string;
  hubspot_contact_id?: string;
  hubspot_success?: boolean;
  connected_with_intent_owner?: boolean;
  intent_owner?: string;
  event_type?: string;
  business_owner?: string;
  skip_reason?: string;
  task_id?: string;
}

function logRoutingDecision(entry: LogEntry): void {
  const row = {
    ...entry,
    run_id: currentRunId,
  };
  // Fire-and-forget — never block the main flow
  (async () => {
    try {
      const { error } = await supabase.from("lgm_send_log").insert(row);
      if (error) logger.warn(`lgm_send_log insert failed: ${error.message}`);
    } catch (err) {
      logger.warn(`lgm_send_log insert exception: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();
}

// ============================================
// HUBSPOT HELPERS
// ============================================
async function getHubspotContactIaStatus(
  contactHubspotId: string
): Promise<{ success: boolean; cancelValue: string | null; activatedValue: string | null }> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN ?? "";
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactHubspotId}?properties=cancel_agent_ia_activated,agent_ia_activated`;

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
        properties?: { cancel_agent_ia_activated?: string; agent_ia_activated?: string };
      };
      const cancelValue =
        data.properties?.cancel_agent_ia_activated ?? null;
      const activatedValue =
        data.properties?.agent_ia_activated ?? null;
      logger.info(
        `HubSpot GET OK - Contact: ${contactHubspotId}, cancel: ${cancelValue || "(empty)"}, activated: ${activatedValue || "(empty)"}`
      );
      return { success: true, cancelValue, activatedValue };
    } else {
      const text = await res.text();
      logger.error(`HubSpot GET error ${res.status}: ${text}`);
      return { success: false, cancelValue: null, activatedValue: null };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`HubSpot GET exception: ${msg}`);
    return { success: false, cancelValue: null, activatedValue: null };
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

async function assignHubspotOwnerAndActivate(
  contactHubspotId: string,
  ownerHubspotId: string
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
        properties: {
          hubspot_owner_id: ownerHubspotId,
          agent_ia_activated: "true",
        },
      }),
    });

    if (res.ok) {
      logger.info(
        `HubSpot ASSIGN+ACTIVATE OK - Contact: ${contactHubspotId}, owner: ${ownerHubspotId}`
      );
      return { success: true };
    } else {
      const text = await res.text();
      logger.error(`HubSpot ASSIGN+ACTIVATE error ${res.status}: ${text}`);
      return { success: false };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`HubSpot ASSIGN+ACTIVATE exception: ${msg}`);
    return { success: false };
  }
}

async function assignHubspotOwnerOnly(
  contactHubspotId: string,
  ownerHubspotId: string
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
        properties: {
          hubspot_owner_id: ownerHubspotId,
        },
      }),
    });

    if (res.ok) {
      logger.info(
        `HubSpot ASSIGN OK - Contact: ${contactHubspotId}, owner: ${ownerHubspotId}`
      );
      return { success: true };
    } else {
      const text = await res.text();
      logger.error(`HubSpot ASSIGN error ${res.status}: ${text}`);
      return { success: false };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`HubSpot ASSIGN exception: ${msg}`);
    return { success: false };
  }
}

async function sendSlackIaNotification(params: {
  channelId: string;
  contactName: string;
  contactJob: string;
  companyName: string;
  linkedinUrl: string;
  hubspotContactId: string;
  intentEventType: string;
  intentOwner: string;
  companySize: string;
}): Promise<{ success: boolean }> {
  const token = process.env.slack_agent_ae_sdr_token ?? "";
  if (!token) {
    logger.error("Missing slack_agent_ae_sdr_token env var");
    return { success: false };
  }

  const hubspotUrl = `${HUBSPOT_CONTACT_BASE_URL}/${params.hubspotContactId}`;
  const valuePayload = JSON.stringify({
    hubspot_contact_id: params.hubspotContactId,
    contact_name: params.contactName,
  });

  const body = {
    channel: params.channelId,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: [
            `*Activer l'Agent IA ?*`,
            `*Contact :* <${params.linkedinUrl}|${params.contactName}>`,
            `*Poste :* ${params.contactJob}`,
            `*Entreprise :* ${params.companyName} (${params.companySize} employés)`,
            `*Événement :* ${params.intentEventType}`,
            `*Intent Owner :* ${params.intentOwner}`,
            `*HubSpot :* <${hubspotUrl}|${params.hubspotContactId}>`,
          ].join("\n"),
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Activer", emoji: true },
            style: "primary",
            action_id: "activate_ia",
            value: valuePayload,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Ne jamais activer", emoji: true },
            style: "danger",
            action_id: "never_activate",
            value: valuePayload,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Pas maintenant", emoji: true },
            action_id: "skip_now",
            value: valuePayload,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (data.ok) {
      logger.info(
        `Slack IA notif sent to ${params.channelId} for ${params.contactName}`
      );
      return { success: true };
    } else {
      logger.error(`Slack IA notif error: ${data.error}`);
      return { success: false };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Slack IA notif exception: ${msg}`);
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

function isCompanyLargeEnough(record: IntentEvent): boolean {
  // Priority 1: exact employee count
  const approx = record.COMPANY_APPROX_EMPLOYEE_NB;
  if (approx !== null && approx !== undefined) {
    const num = typeof approx === "number" ? approx : parseInt(String(approx), 10);
    if (!isNaN(num)) return num >= MIN_EMPLOYEES_FOR_HUBSPOT;
  }

  // Priority 2: size range lower bound from "[X-Y]" or "[X,Y]"
  const range = record.COMPANY_SIZE_RANGE;
  if (range && typeof range === "string") {
    const match = range.match(/\[(\d+)[,\-]/);
    if (match) {
      const lowerBound = parseInt(match[1], 10);
      if (!isNaN(lowerBound)) return lowerBound >= MIN_EMPLOYEES_FOR_HUBSPOT;
    }
  }

  // Both null/unparseable → conservateur → skip
  return false;
}

function normalizeOwner(owner: string | undefined | null): string {
  if (!owner) return "unknown";
  return owner
    .toLowerCase()
    .trim()
    .replace(/[\r\n\t]/g, "")
    .replace(/\s+/g, "_");
}

function buildMappingKey(
  intentOwner: string | undefined,
  eventType: string | undefined,
  connectedWithIntentOwner: boolean | undefined
): string {
  const ownerLower = normalizeOwner(intentOwner);
  const connectedStatus =
    connectedWithIntentOwner === true
      ? "connected_true"
      : "connected_false";
  return `${ownerLower}|${eventType}|${connectedStatus}`;
}

function getActionForRecord(
  intentOwner: string | undefined,
  eventType: string | undefined,
  connectedWithIntentOwner: boolean | undefined
): { action: string | null; keyExists: boolean; key: string } {
  const key = buildMappingKey(
    intentOwner,
    eventType,
    connectedWithIntentOwner
  );
  const keyExists = key in AUDIENCE_MAPPING;
  const action = keyExists ? AUDIENCE_MAPPING[key] : null;
  return { action, keyExists, key };
}

function getHubspotIdForIntentOwner(
  intentOwner: string | undefined,
  teamMembers: TeamMember[]
): string | null {
  if (!intentOwner) return null;
  const member = teamMembers.find(
    (m) => m.hubspot_connected_with_value === intentOwner
  );
  return member?.hubspot_id ?? null;
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
async function processIntentEvents(teamMembers: TeamMember[], lookbackDays = 1) {
  logger.info("--- Processing Intent Events ---");

  const events = await getIntentEvents(lookbackDays);

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

  // Accumulate Slack IA notifications to deduplicate by contact (multiple events → 1 notif)
  const pendingSlackNotifs = new Map<string, {
    contactName: string;
    contactJob: string;
    companyName: string;
    linkedinUrl: string;
    hubspotContactId: string;
    intentOwner: string;
    companySize: string;
    eventTypes: string[];
    channelId: string;
    record: IntentEvent; // keep first record for log base
  }>();
  // Track contacts already assigned an owner (avoid duplicate PATCH)
  const assignedOwnerContacts = new Set<string>();

  for (const record of events) {
    const fullName =
      `${record.CONTACT_FIRST_NAME ?? ""} ${record.CONTACT_LAST_NAME ?? ""}`.trim();

    // Shared base for audit log entries
    const logBase = {
      linkedin_url: record.CONTACT_LINKEDIN_PROFILE_URL,
      first_name: record.CONTACT_FIRST_NAME,
      last_name: record.CONTACT_LAST_NAME,
      company: record.COMPANY_NAME,
      source: "intent_event" as const,
      connected_with_intent_owner: record.CONNECTED_WITH_INTENT_OWNER,
      intent_owner: record.INTENT_OWNER,
      event_type: record.INTENT_EVENT_TYPE,
      business_owner: record.BUSINESS_OWNER,
      task_id: "lgm-process-intent-events",
    };

    if (isExcludedProfile(record.CONTACT_LINKEDIN_PROFILE_URL)) {
      logger.info(`Excluded: ${fullName}`);
      logRoutingDecision({ ...logBase, destination: "EXCLUDED", skip_reason: "excluded_profile" });
      excluded++;
      continue;
    }

    let shouldSendSlack = true;
    let action: string | null = null;

    // --- Follow Page: always LGM to page audience ---
    if (record.INTENT_EVENT_TYPE === "Follow Page") {
      const pageOrigin = record.EVENT_RECORD_ORIGIN ?? "";
      const pageAudience = PAGE_AUDIENCES[pageOrigin];

      if (pageAudience) {
        action = pageAudience;
        const lgmPayload = buildIntentEventLgmPayload(record, pageAudience);
        const lgmResult = await sendToLgm(lgmPayload);
        logRoutingDecision({
          ...logBase, destination: pageAudience,
          lgm_http_status: lgmResult.httpStatus, lgm_response_msg: lgmResult.message, lgm_lead_id: lgmResult.leadId,
        });
        if (lgmResult.success) {
          lgmSuccess++;
        } else {
          lgmFailed++;
          shouldSendSlack = false;
        }
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_API_CALLS);
      } else {
        logger.warn(`Unknown Follow Page origin: "${pageOrigin}" for ${fullName}`);
        logRoutingDecision({ ...logBase, destination: "SKIPPED", skip_reason: "unknown_page_origin" });
        lgmSkipped++;
        shouldSendSlack = false;
      }

      processedEvents.push({ record, action, shouldSendSlack });
      processed++;
      await sleep(RATE_LIMIT.PAUSE_BETWEEN_EVENTS);
      continue;
    }

    // --- All other events: routing based on INTENT_OWNER + CONNECTED_WITH_INTENT_OWNER ---
    const { action: mappedAction, keyExists, key } = getActionForRecord(
      record.INTENT_OWNER,
      record.INTENT_EVENT_TYPE,
      record.CONNECTED_WITH_INTENT_OWNER
    );
    action = mappedAction;

    // Track unmapped keys
    if (!keyExists) {
      const rawOwner = record.INTENT_OWNER || "(empty)";
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

    if (action === "HUBSPOT") {
      // Filter: skip small companies for HubSpot routing
      if (!isCompanyLargeEnough(record)) {
        const sizeInfo = record.COMPANY_APPROX_EMPLOYEE_NB ?? record.COMPANY_SIZE_RANGE ?? "unknown";
        logger.info(`HubSpot skip - Company too small (${sizeInfo}) for ${fullName}`);
        logRoutingDecision({ ...logBase, destination: "SKIPPED", skip_reason: "company_too_small" });
        hubspotSkipped++;
        shouldSendSlack = false;
        processedEvents.push({ record, action, shouldSendSlack });
        processed++;
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_EVENTS);
        continue;
      }

      // Connected with intent owner → HubSpot routing based on BUSINESS_OWNER
      const contactHubspotId = record.CONTACT_HUBSPOT_ID;

      if (!contactHubspotId) {
        logger.info(`HubSpot skip - No CONTACT_HUBSPOT_ID for ${fullName}`);
        logRoutingDecision({ ...logBase, destination: "SKIPPED", skip_reason: "no_hubspot_id" });
        hubspotSkipped++;
        shouldSendSlack = false;
      } else {
        const businessOwner = record.BUSINESS_OWNER;
        const intentOwner = record.INTENT_OWNER;

        if (!businessOwner) {
          // Cas 1: BUSINESS_OWNER is null → assign owner immediately, then queue Slack notif for activation
          const intentOwnerHubspotId = getHubspotIdForIntentOwner(intentOwner, teamMembers);
          if (intentOwnerHubspotId) {
            // Step 1: Assign owner only (skip if already assigned for this contact in this run)
            if (!assignedOwnerContacts.has(contactHubspotId)) {
              const assignResult = await assignHubspotOwnerOnly(
                contactHubspotId,
                intentOwnerHubspotId
              );
              logRoutingDecision({
                ...logBase, destination: "HUBSPOT_ASSIGN",
                hubspot_contact_id: contactHubspotId, hubspot_success: assignResult.success,
              });
              if (!assignResult.success) {
                hubspotFailed++;
                shouldSendSlack = false;
                processedEvents.push({ record, action, shouldSendSlack });
                processed++;
                await sleep(RATE_LIMIT.PAUSE_BETWEEN_EVENTS);
                continue;
              }
              assignedOwnerContacts.add(contactHubspotId);
            }

            // Step 2: Check cancel + already activated before queuing notification (only on first occurrence)
            if (!pendingSlackNotifs.has(contactHubspotId)) {
              const iaStatus = await getHubspotContactIaStatus(contactHubspotId);
              if (!iaStatus.success) {
                // HubSpot API error — do NOT queue notification (safe default: skip)
                logger.error(`HubSpot GET failed for ${fullName} (${contactHubspotId}) — skipping notification`);
                logRoutingDecision({
                  ...logBase, destination: "SKIPPED", skip_reason: "hubspot_get_failed",
                  hubspot_contact_id: contactHubspotId, hubspot_success: false,
                });
                hubspotFailed++;
                shouldSendSlack = false;
              } else if (iaStatus.cancelValue !== null &&
                  iaStatus.cancelValue !== "" && iaStatus.cancelValue !== undefined) {
                logger.info(`HubSpot skip notif - cancel_agent_ia non-empty for ${fullName} (owner assigned)`);
                hubspotSuccess++;
                shouldSendSlack = true;
              } else if (iaStatus.activatedValue === "true") {
                logger.info(`HubSpot skip notif - agent_ia already activated for ${fullName} (owner assigned)`);
                logRoutingDecision({
                  ...logBase, destination: "SKIPPED", skip_reason: "already_activated",
                  hubspot_contact_id: contactHubspotId,
                });
                hubspotSkipped++;
                shouldSendSlack = false;
              } else {
                // Step 3: Queue Slack notification (will be sent after loop, merged by contact)
                const slackChannelId = SLACK_IA_CHANNELS[normalizeOwner(intentOwner)];
                if (slackChannelId) {
                  pendingSlackNotifs.set(contactHubspotId, {
                    contactName: fullName,
                    contactJob: record.CONTACT_JOB ?? "",
                    companyName: record.COMPANY_NAME ?? "",
                    linkedinUrl: record.CONTACT_LINKEDIN_PROFILE_URL ?? "",
                    hubspotContactId: contactHubspotId,
                    intentOwner: intentOwner ?? "",
                    companySize: String(record.COMPANY_APPROX_EMPLOYEE_NB ?? record.COMPANY_SIZE_RANGE ?? "?"),
                    eventTypes: [record.INTENT_EVENT_TYPE ?? ""],
                    channelId: slackChannelId,
                    record,
                  });
                  hubspotSuccess++;
                  shouldSendSlack = true;
                } else {
                  logger.warn(`No Slack channel configured for intent owner: ${intentOwner}`);
                  hubspotSuccess++;
                  shouldSendSlack = true;
                }
              }
            } else {
              // Already queued for this contact → merge event type
              const pending = pendingSlackNotifs.get(contactHubspotId)!;
              const eventType = record.INTENT_EVENT_TYPE ?? "";
              if (eventType && !pending.eventTypes.includes(eventType)) {
                pending.eventTypes.push(eventType);
              }
              hubspotSuccess++;
              shouldSendSlack = true;
            }
          } else {
            logger.warn(`No HubSpot ID found for intent owner: ${intentOwner}`);
            logRoutingDecision({
              ...logBase, destination: "HUBSPOT_ASSIGN",
              hubspot_contact_id: contactHubspotId, hubspot_success: false,
            });
            hubspotFailed++;
            shouldSendSlack = false;
          }
        } else if (businessOwner === intentOwner) {
          // Cas 2: BUSINESS_OWNER = INTENT_OWNER → check cancel + already activated, then queue Slack notif
          // Only check on first occurrence for this contact
          if (!pendingSlackNotifs.has(contactHubspotId)) {
            const getResult =
              await getHubspotContactIaStatus(contactHubspotId);

            if (!getResult.success) {
              logRoutingDecision({
                ...logBase, destination: "HUBSPOT_ACTIVATE",
                hubspot_contact_id: contactHubspotId, hubspot_success: false,
              });
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
              logRoutingDecision({
                ...logBase, destination: "SKIPPED", skip_reason: "cancel_agent_ia",
                hubspot_contact_id: contactHubspotId,
              });
              hubspotSkipped++;
              shouldSendSlack = false;
            } else if (getResult.activatedValue === "true") {
              logger.info(
                `HubSpot skip - agent_ia already activated for ${fullName}`
              );
              logRoutingDecision({
                ...logBase, destination: "SKIPPED", skip_reason: "already_activated",
                hubspot_contact_id: contactHubspotId,
              });
              hubspotSkipped++;
              shouldSendSlack = false;
            } else {
              // Queue Slack notification (will be sent after loop, merged by contact)
              const slackChannelId = SLACK_IA_CHANNELS[normalizeOwner(intentOwner)];
              if (slackChannelId) {
                pendingSlackNotifs.set(contactHubspotId, {
                  contactName: fullName,
                  contactJob: record.CONTACT_JOB ?? "",
                  companyName: record.COMPANY_NAME ?? "",
                  linkedinUrl: record.CONTACT_LINKEDIN_PROFILE_URL ?? "",
                  hubspotContactId: contactHubspotId,
                  intentOwner: intentOwner ?? "",
                  companySize: String(record.COMPANY_APPROX_EMPLOYEE_NB ?? record.COMPANY_SIZE_RANGE ?? "?"),
                  eventTypes: [record.INTENT_EVENT_TYPE ?? ""],
                  channelId: slackChannelId,
                  record,
                });
                hubspotSuccess++;
                shouldSendSlack = true;
              } else {
                logger.warn(`No Slack channel configured for intent owner: ${intentOwner}`);
                hubspotSuccess++;
                shouldSendSlack = true;
              }
            }
          } else {
            // Already queued for this contact → merge event type
            const pending = pendingSlackNotifs.get(contactHubspotId)!;
            const eventType = record.INTENT_EVENT_TYPE ?? "";
            if (eventType && !pending.eventTypes.includes(eventType)) {
              pending.eventTypes.push(eventType);
            }
            hubspotSuccess++;
            shouldSendSlack = true;
          }
        } else {
          // Cas 3: BUSINESS_OWNER ≠ INTENT_OWNER → skip for now
          logger.info(
            `HubSpot skip - BO(${businessOwner}) ≠ IO(${intentOwner}) for ${fullName}`
          );
          logRoutingDecision({
            ...logBase, destination: "SKIPPED", skip_reason: "cross_owner",
            hubspot_contact_id: contactHubspotId,
          });
          hubspotSkipped++;
          shouldSendSlack = false;
        }
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_API_CALLS);
      }
    } else if (action !== null) {
      // Not connected with intent owner → LGM
      const lgmPayload = buildIntentEventLgmPayload(record, action);
      const lgmResult = await sendToLgm(lgmPayload);
      logRoutingDecision({
        ...logBase, destination: action,
        lgm_http_status: lgmResult.httpStatus, lgm_response_msg: lgmResult.message, lgm_lead_id: lgmResult.leadId,
      });

      if (lgmResult.success) {
        lgmSuccess++;
      } else {
        lgmFailed++;
        shouldSendSlack = false;
      }
      await sleep(RATE_LIMIT.PAUSE_BETWEEN_API_CALLS);
    } else {
      // action === null → skip (unmapped key)
      logRoutingDecision({ ...logBase, destination: "UNMAPPED", skip_reason: "unmapped_key" });
      lgmSkipped++;
      shouldSendSlack = false;
    }

    processedEvents.push({ record, action, shouldSendSlack });
    processed++;

    await sleep(RATE_LIMIT.PAUSE_BETWEEN_EVENTS);
  }

  // --- Send accumulated Slack IA notifications (1 per contact, merged event types) ---
  let slackNotifSent = 0;
  let slackNotifFailed = 0;
  for (const [hubspotId, notif] of pendingSlackNotifs) {
    const mergedEventTypes = notif.eventTypes.join(" + ");
    logger.info(`Sending Slack IA notif for ${notif.contactName} (${mergedEventTypes})`);

    const notifResult = await sendSlackIaNotification({
      channelId: notif.channelId,
      contactName: notif.contactName,
      contactJob: notif.contactJob,
      companyName: notif.companyName,
      linkedinUrl: notif.linkedinUrl,
      hubspotContactId: notif.hubspotContactId,
      intentEventType: mergedEventTypes,
      intentOwner: notif.intentOwner,
      companySize: notif.companySize,
    });

    const logBase = {
      linkedin_url: notif.record.CONTACT_LINKEDIN_PROFILE_URL,
      first_name: notif.record.CONTACT_FIRST_NAME,
      last_name: notif.record.CONTACT_LAST_NAME,
      company: notif.record.COMPANY_NAME,
      source: "intent_event" as const,
      connected_with_intent_owner: notif.record.CONNECTED_WITH_INTENT_OWNER,
      intent_owner: notif.record.INTENT_OWNER,
      event_type: mergedEventTypes,
      business_owner: notif.record.BUSINESS_OWNER,
      task_id: "lgm-process-intent-events",
    };

    logRoutingDecision({
      ...logBase, destination: "SLACK_NOTIF_SENT",
      hubspot_contact_id: hubspotId, hubspot_success: notifResult.success,
    });

    if (notifResult.success) {
      slackNotifSent++;
    } else {
      slackNotifFailed++;
    }

    await sleep(RATE_LIMIT.PAUSE_BETWEEN_API_CALLS);
  }

  logger.info(
    `Intent Events done: ${processed} processed, ${excluded} excluded, ` +
      `LGM ${lgmSuccess}/${lgmFailed}/${lgmSkipped}, ` +
      `HubSpot ${hubspotSuccess}/${hubspotFailed}/${hubspotSkipped}, ` +
      `Slack notifs ${slackNotifSent}/${slackNotifFailed}`
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
async function processConcurrentContacts(teamMembers: TeamMember[], lookbackDays = 1) {
  logger.info("--- Processing Concurrent Contacts ---");

  const bertranInfo = getBertranFromTeam(teamMembers);
  logger.info(
    `Bertran - HubSpot Owner ID: ${bertranInfo.hubspotOwnerId}`
  );

  const contacts = await getConcurrentContacts(lookbackDays);

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

    const logBase = {
      linkedin_url: record.linkedin_profile_url,
      first_name: record.first_name,
      last_name: record.last_name,
      company: record.company_name,
      source: "concurrent_contact" as const,
      task_id: "lgm-process-intent-events",
    };

    if (isExcludedProfile(record.linkedin_profile_url)) {
      logger.info(`Excluded: ${fullName}`);
      logRoutingDecision({ ...logBase, destination: "EXCLUDED", skip_reason: "excluded_profile" });
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
      logRoutingDecision({
        ...logBase, destination: audience,
        lgm_http_status: lgmResult.httpStatus, lgm_response_msg: lgmResult.message, lgm_lead_id: lgmResult.leadId,
      });

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
          await getHubspotContactIaStatus(existingHubspotId);

        if (!getResult.success) {
          logRoutingDecision({
            ...logBase, destination: "HUBSPOT_ACTIVATE",
            hubspot_contact_id: existingHubspotId, hubspot_success: false,
          });
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
          logRoutingDecision({
            ...logBase, destination: "SKIPPED", skip_reason: "cancel_agent_ia",
            hubspot_contact_id: existingHubspotId,
          });
          hubspotUpdateSkipped++;
        } else if (getResult.activatedValue === "true") {
          logger.info(
            `HubSpot skip - agent_ia already activated for ${fullName}`
          );
          logRoutingDecision({
            ...logBase, destination: "SKIPPED", skip_reason: "already_activated",
            hubspot_contact_id: existingHubspotId,
          });
          hubspotUpdateSkipped++;
        } else {
          const updateResult =
            await updateHubspotContactAgentActivated(existingHubspotId);
          logRoutingDecision({
            ...logBase, destination: "HUBSPOT_ACTIVATE",
            hubspot_contact_id: existingHubspotId, hubspot_success: updateResult.success,
          });
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
        logRoutingDecision({
          ...logBase, destination: "HUBSPOT_CREATE",
          hubspot_success: createResult.success,
        });
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
  owner: string | undefined,
  teamMembers: TeamMember[]
): string | null {
  if (!owner) return null;
  const normalizedOwner = normalizeOwner(owner);

  const member = teamMembers.find(
    (m) =>
      m.hubspot_connected_with_value &&
      normalizeOwner(m.hubspot_connected_with_value) ===
        normalizedOwner
  );

  return member?.slack_id ?? null;
}

function formatGroupedEventLines(records: IntentEvent[]): string {
  // Group by contact to merge multiple event types on one line
  const grouped = new Map<
    string,
    { record: IntentEvent; eventTypes: string[]; connected: boolean }
  >();

  for (const record of records) {
    const key =
      record.CONTACT_LINKEDIN_PROFILE_URL ??
      record.CONTACT_HUBSPOT_ID ??
      `${record.CONTACT_FIRST_NAME}_${record.CONTACT_LAST_NAME}`;
    const existing = grouped.get(key);
    const eventType = record.INTENT_EVENT_TYPE ?? "";
    if (existing) {
      if (eventType && !existing.eventTypes.includes(eventType)) {
        existing.eventTypes.push(eventType);
      }
      if (record.CONNECTED_WITH_INTENT_OWNER === true) {
        existing.connected = true;
      }
    } else {
      grouped.set(key, {
        record,
        eventTypes: eventType ? [eventType] : [],
        connected: record.CONNECTED_WITH_INTENT_OWNER === true,
      });
    }
  }

  let result = "";
  for (const { record, eventTypes, connected } of grouped.values()) {
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

    const connectionStatus = connected ? "connected" : "not connected";

    let line = `• ${fullName}`;
    if (jobLine) line += ` - ${jobLine}`;
    line += ` (${eventTypes.join(" + ")}, ${connectionStatus})`;

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

    result += `${line}\n${linksLine}\n`;
  }

  return result;
}

async function sendGroupedSlackMessage(
  processedEvents: ProcessedEvent[],
  teamMembers: TeamMember[],
  errorCount: number
): Promise<{ success: boolean }> {
  const webhookUrl = process.env.webhook_intent_events_lgm_activity ?? "";

  const eventsToSend = processedEvents.filter((e) => e.shouldSendSlack);

  if (eventsToSend.length === 0) {
    logger.info("No events to send to Slack");
    return { success: true };
  }

  if (!webhookUrl) {
    logger.warn("webhook_intent_events_lgm_activity not set, skipping");
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
    const isFollowPage = event.record.INTENT_EVENT_TYPE === "Follow Page";

    if (isFollowPage) {
      const pageOrigin = event.record.EVENT_RECORD_ORIGIN ?? "unknown";
      pagesEvents.push({
        record: event.record,
        pageName: pageOrigin,
      });
    } else {
      const normalizedOwner = normalizeOwner(event.record.INTENT_OWNER);

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
      message += formatGroupedEventLines(events.hubspot);
    }

    if (events.lgm.length > 0) {
      message += `→ *LGM*\n`;
      message += formatGroupedEventLines(events.lgm);
    }
  }

  // Section Pages — group by contact to merge multiple page follows
  if (pagesEvents.length > 0) {
    message += `\n📄 *Pages* → LGM\n`;

    const groupedPages = new Map<string, { record: IntentEvent; pageNames: string[] }>();
    for (const event of pagesEvents) {
      const key = event.record.CONTACT_LINKEDIN_PROFILE_URL ?? event.record.CONTACT_HUBSPOT_ID ?? `${event.record.CONTACT_FIRST_NAME}_${event.record.CONTACT_LAST_NAME}`;
      const existing = groupedPages.get(key);
      if (existing) {
        existing.pageNames.push(event.pageName);
      } else {
        groupedPages.set(key, { record: event.record, pageNames: [event.pageName] });
      }
    }

    for (const { record, pageNames } of groupedPages.values()) {
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
      line += ` (Follow Page ${pageNames.join(", ")})`;

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
      message += `\n  → INTENT_OWNER brut: \`${k.rawOwner}\``;
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
