import { logger, schedules } from "@trigger.dev/sdk/v3";
import { getAiAeSdrSupabase } from "./lib/ai-ae-sdr-supabase.js";
import {
  sleep,
  sendErrorToScriptLogs,
  type TaskError,
} from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const LANGGRAPH_ASSISTANT_ID = "full_pipeline";
const RATE_LIMIT_BETWEEN_SENDS = 5000;
const PAGE_SIZE = 1000;
const MAX_CONTACTS_PER_OWNER = 15;
const COOLDOWN_DAYS = 3;

// Pipeline SQL active deal stages — contacts with at least one of these
// are prioritized (Tier 1) over contacts without active deals (Tier 2)
const ACTIVE_DEAL_STAGES = new Set([
  "Démo Airsaas",
  "Rendez-vous a planifier",
  "N-1 Champion paradigme in process",
  "Executive à attraper avec le champion",
  "1-1 Executive attrapé",
  "1-1 Executive attrapé ",
  "Go Meeting Pro2LT Avant vente",
  "1-1 Executive Debrief",
  "ABM pour attraper l'executive",
  "No Show - retry",
  "Présentation Equipe planifié",
  "Go Meeting Pro2LT Vente",
  "Présentation planning accompagnement",
  "GO !",
]);

// ============================================
// TYPES
// ============================================
interface PrcActivity {
  CONTACT_HUBSPOT_ID?: string;
  CONTACT_FULL_NAME?: string;
  CONTACT?: string | Record<string, unknown>;
  DEALS?: string | unknown[];
  OWNER_INTENT_HUBSPOT?: string | Record<string, unknown>;
  OWNER_CONTACT_INTENT_HUBSPOT?: string | Record<string, unknown>;
  SENDER?: string | Record<string, unknown>;
  ACTIVITY_ID?: string;
  ACTIVITY_TYPE?: string;
  ACTIVITY_RECORDED_ON?: string;
  ACTIVITY_DIRECTION?: string;
  ACTIVITY_METADATA?: string | Record<string, unknown>;
  IS_CONTACT_IA_AGENT_ACTIVATED?: boolean;
  IS_CANCEL_AGENT_IA_ACTIVATED?: boolean;
  _airbyte_generation_id?: number;
}

interface Deal {
  deal_hubspot_id?: string;
  deal_name?: string;
  deal_stage?: string;
  deal_closed_date?: string;
  deal_created_date?: string;
  deal_owner_name?: string;
  deal_owner_hubspot_id?: string;
  is_deal_ia_agent_activated?: boolean;
}

interface ContactPayload {
  contact_info: {
    hubspot_id: string;
    full_name: string | null;
    name: string | null;
    job: string | null;
    job_strategic_role: string | null;
    phone: string | null;
    location: string | null;
    company: string | null;
    company_hubspot_id: string | null;
    linkedin_url: string | null;
    linkedin_urn: string | null;
    is_ia_agent_activated: boolean;
    owner_contact: unknown;
  };
  activities: {
    activity_id: string | undefined;
    activity_type: string | undefined;
    recorded_on: string | undefined;
    direction: string | undefined;
    metadata: unknown;
    owner_intent: unknown;
    sender: unknown;
    deals: {
      deal_hubspot_id: string | undefined;
      deal_name: string | undefined;
      dealstage: string | null;
      deal_closed_date: string | undefined;
      deal_created_date: string | undefined;
      deal_owner_name: string | undefined;
      deal_owner_hubspot_id: string | undefined;
      is_deal_ia_agent_activated: boolean | undefined;
    }[] | null;
  }[];
  stats: {
    total_activities: number;
    by_type: Record<string, number>;
  };
}

interface OwnerStats {
  ownerName: string;
  totalEligible: number;
  cooldownSkipped: number;
  noOwnerSkipped?: boolean;
  tier1: number;
  tier2: number;
  sent: number;
  errored: number;
  remaining: number;
}

// ============================================
// SCHEDULED TASK
// ============================================
export const sendContactsToLanggraphTask = schedules.task({
  id: "send-contacts-to-langgraph",
  maxDuration: 900,
  run: async () => {
    logger.info("=== START send-contacts-to-langgraph ===");

    const batchId = new Date().toISOString().substring(0, 19);
    const errors: TaskError[] = [];
    const sb = getAiAeSdrSupabase();

    // 1. Fetch all activities from PRC_CONTACT_ACTIVITIES
    logger.info("Fetching PRC_CONTACT_ACTIVITIES...");
    const allActivities = await fetchAllActivities();
    logger.info(`${allActivities.length} total rows fetched`);

    // 2. Filter: IS_CONTACT_IA_AGENT_ACTIVATED === true
    const filtered = allActivities.filter(
      (a) =>
        a.IS_CONTACT_IA_AGENT_ACTIVATED === true &&
        a.IS_CANCEL_AGENT_IA_ACTIVATED !== true
    );
    logger.info(
      `${filtered.length} activities with IA agent activated (${
        allActivities.length > 0
          ? Math.round((filtered.length / allActivities.length) * 100)
          : 0
      }%)`
    );

    // 3. Group by CONTACT_HUBSPOT_ID
    const grouped: Record<string, PrcActivity[]> = {};
    for (const activity of filtered) {
      const contactId = activity.CONTACT_HUBSPOT_ID;
      if (!contactId) continue;
      if (!grouped[contactId]) grouped[contactId] = [];
      grouped[contactId].push(activity);
    }
    const allContactIds = Object.keys(grouped);
    logger.info(`${allContactIds.length} unique contacts`);

    // 4. Resolve owner for each contact (from OWNER_CONTACT_INTENT_HUBSPOT.owner_hubspot_id)
    const contactOwnerMap = new Map<string, { id: string; name: string }>();
    const noOwnerSkipped: string[] = [];

    for (const contactId of allContactIds) {
      const owner = getContactOwner(grouped[contactId]);
      if (owner) {
        contactOwnerMap.set(contactId, owner);
      } else {
        noOwnerSkipped.push(contactId);
      }
    }

    logger.info(
      `${contactOwnerMap.size} contacts with owner | ${noOwnerSkipped.length} skipped (no owner)`
    );

    // 5. Fetch recent final_decisions (last COOLDOWN_DAYS days) for cooldown
    const cooldownDate = new Date(
      Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data: recentDecisions, error: fdError } = await sb
      .from("final_decision")
      .select("contact_hubspot_id, created_at")
      .gte("created_at", cooldownDate);

    if (fdError) {
      throw new Error(`Failed to fetch final_decision: ${fdError.message}`);
    }

    const recentDecisionSet = new Set<string>();
    for (const row of recentDecisions ?? []) {
      if (row.contact_hubspot_id) recentDecisionSet.add(row.contact_hubspot_id);
    }

    // Fetch ALL final_decisions for prioritization (oldest decision first)
    const { data: allDecisions, error: allFdError } = await sb
      .from("final_decision")
      .select("contact_hubspot_id, created_at");

    if (allFdError) {
      throw new Error(
        `Failed to fetch all final_decisions: ${allFdError.message}`
      );
    }

    const allLastDecisionMap = new Map<string, string>();
    for (const row of allDecisions ?? []) {
      const cid = row.contact_hubspot_id;
      if (!cid) continue;
      const existing = allLastDecisionMap.get(cid);
      if (!existing || row.created_at > existing) {
        allLastDecisionMap.set(cid, row.created_at);
      }
    }

    // 6. Group contacts by owner, then apply cooldown + prioritization per owner
    const ownerContacts = new Map<string, { name: string; contactIds: string[] }>();

    for (const [contactId, owner] of contactOwnerMap) {
      let entry = ownerContacts.get(owner.id);
      if (!entry) {
        entry = { name: owner.name, contactIds: [] };
        ownerContacts.set(owner.id, entry);
      }
      entry.contactIds.push(contactId);
    }

    const ownerStatsMap = new Map<string, OwnerStats>();
    const toSendAll: { contactId: string; ownerId: string }[] = [];

    for (const [ownerId, { name: ownerName, contactIds }] of ownerContacts) {
      const cooldownSkipped: string[] = [];
      const eligible: string[] = [];

      for (const contactId of contactIds) {
        if (recentDecisionSet.has(contactId)) {
          cooldownSkipped.push(contactId);
        } else {
          eligible.push(contactId);
        }
      }

      // Prioritize: Tier 1 (active deal) > Tier 2, then FIFO by oldest decision
      const tier1: string[] = [];
      const tier2: string[] = [];

      for (const contactId of eligible) {
        if (hasActiveDeal(grouped[contactId])) {
          tier1.push(contactId);
        } else {
          tier2.push(contactId);
        }
      }

      const sortByDecisionAge = (a: string, b: string) => {
        const aDate = allLastDecisionMap.get(a);
        const bDate = allLastDecisionMap.get(b);
        if (!aDate && bDate) return -1;
        if (aDate && !bDate) return 1;
        if (!aDate && !bDate) return 0;
        return aDate! < bDate! ? -1 : aDate! > bDate! ? 1 : 0;
      };

      tier1.sort(sortByDecisionAge);
      tier2.sort(sortByDecisionAge);

      const prioritized = [...tier1, ...tier2];
      const toSend = prioritized.slice(0, MAX_CONTACTS_PER_OWNER);
      const remaining = prioritized.length - toSend.length;

      for (const contactId of toSend) {
        toSendAll.push({ contactId, ownerId });
      }

      ownerStatsMap.set(ownerId, {
        ownerName,
        totalEligible: contactIds.length,
        cooldownSkipped: cooldownSkipped.length,
        tier1: tier1.length,
        tier2: tier2.length,
        sent: 0, // updated after sending
        errored: 0,
        remaining,
      });

      logger.info(
        `[${ownerName}] ${eligible.length} eligible (${cooldownSkipped.length} cooldown) | T1: ${tier1.length} T2: ${tier2.length} | Sending: ${toSend.length} | Remaining: ${remaining}`
      );
    }

    // 7. Send each contact to LangGraph
    let totalSent = 0;
    let totalErrors = 0;

    for (const { contactId, ownerId } of toSendAll) {
      const activities = grouped[contactId];
      const stats = ownerStatsMap.get(ownerId)!;

      try {
        const payload = buildContactPayload(contactId, activities);
        const lgResult = await sendToLangGraph(payload);

        if (lgResult.success) {
          totalSent++;
          stats.sent++;
          logger.info(
            `[${stats.ownerName}] Sent ${contactId} (${payload.contact_info.full_name}) — ${payload.stats.total_activities} activities`
          );
        } else {
          totalErrors++;
          stats.errored++;
          errors.push({
            type: "LangGraph Send",
            code: lgResult.statusCode ?? "unknown",
            message: lgResult.error ?? "unknown error",
            profile: contactId,
          });
          logger.error(`LangGraph error for ${contactId}: ${lgResult.error}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        totalErrors++;
        stats.errored++;
        errors.push({
          type: "Processing",
          code: "exception",
          message: msg,
          profile: contactId,
        });
        logger.error(`Exception processing ${contactId}: ${msg}`);
      }

      await sleep(RATE_LIMIT_BETWEEN_SENDS);
    }

    // 8. Send Slack recap
    await sendSlackRecap({
      batchId,
      ownerStats: ownerStatsMap,
      noOwnerSkipped: noOwnerSkipped.length,
      totalSent,
      totalErrors,
    });

    // 9. Send errors to script_logs
    await sendErrorToScriptLogs("Send Contacts to LangGraph", [
      {
        label: "Contacts",
        inserted: totalSent,
        skipped: noOwnerSkipped.length + [...ownerStatsMap.values()].reduce((s, o) => s + o.cooldownSkipped, 0),
        errors,
      },
    ]);

    const summary = {
      success: true,
      batchId,
      totalActivities: allActivities.length,
      filteredActivities: filtered.length,
      uniqueContacts: allContactIds.length,
      noOwnerSkipped: noOwnerSkipped.length,
      owners: Object.fromEntries(ownerStatsMap),
      sent: totalSent,
      errors: totalErrors,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// OWNER RESOLUTION
// ============================================
function getContactOwner(
  activities: PrcActivity[]
): { id: string; name: string } | null {
  for (const activity of activities) {
    const ownerData = parseJsonField(activity.OWNER_CONTACT_INTENT_HUBSPOT) as Record<string, unknown> | null;
    if (!ownerData) continue;
    const ownerId = ownerData.owner_hubspot_id;
    if (ownerId) {
      return {
        id: String(ownerId),
        name: (ownerData.owner_name as string) ?? String(ownerId),
      };
    }
  }
  return null;
}

// ============================================
// ACTIVE DEAL CHECK
// ============================================
function hasActiveDeal(activities: PrcActivity[]): boolean {
  for (const activity of activities) {
    const deals = parseJsonField(activity.DEALS) as Deal[] | null;
    if (!Array.isArray(deals)) continue;
    for (const deal of deals) {
      if (deal.deal_stage && ACTIVE_DEAL_STAGES.has(deal.deal_stage.trim())) {
        return true;
      }
    }
  }
  return false;
}

// ============================================
// SUPABASE FETCH (SOURCE)
// ============================================
async function fetchAllActivities(): Promise<PrcActivity[]> {
  const allData: PrcActivity[] = [];
  let offset = 0;
  let pageNumber = 0;

  while (true) {
    pageNumber++;
    const { data, error } = await getAiAeSdrSupabase()
      .from("PRC_CONTACT_ACTIVITIES")
      .select("*")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(
        `Failed to fetch PRC_CONTACT_ACTIVITIES page ${pageNumber}: ${error.message}`
      );
    }

    const pageData = (data ?? []) as PrcActivity[];
    allData.push(...pageData);
    logger.info(`Page ${pageNumber}: ${pageData.length} rows (total: ${allData.length})`);

    if (pageData.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allData;
}

// ============================================
// JSON BUILDER (mirrors GAS buildContactJson)
// ============================================
function parseJsonField(field: unknown): Record<string, unknown> | unknown[] | null {
  if (!field) return null;
  if (typeof field === "string") {
    try {
      return JSON.parse(field);
    } catch {
      return null;
    }
  }
  if (typeof field === "object") return field as Record<string, unknown>;
  return null;
}

function deduplicateActivities(activities: PrcActivity[]): PrcActivity[] {
  const uniqueMap: Record<string, PrcActivity> = {};

  for (const activity of activities) {
    const activityId = activity.ACTIVITY_ID;
    if (!activityId) continue;

    const generation = activity._airbyte_generation_id ?? 0;
    const existing = uniqueMap[activityId];

    if (!existing || (existing._airbyte_generation_id ?? 0) < generation) {
      uniqueMap[activityId] = activity;
    }
  }

  return Object.values(uniqueMap);
}

function buildContactPayload(
  contactId: string,
  activities: PrcActivity[]
): ContactPayload {
  const firstActivity = activities[0];
  const contactData = (parseJsonField(firstActivity.CONTACT) ?? {}) as Record<
    string,
    unknown
  >;
  const ownerContactData = parseJsonField(
    firstActivity.OWNER_CONTACT_INTENT_HUBSPOT
  );

  const contactPayload: ContactPayload = {
    contact_info: {
      hubspot_id: contactId,
      full_name: (firstActivity.CONTACT_FULL_NAME as string) ?? null,
      name: (contactData.contact_name as string) ?? null,
      job: (contactData.contact_job as string) ?? null,
      job_strategic_role:
        (contactData.contact_job_strategic_role as string) ?? null,
      phone: (contactData.contact_consolidated_phone as string) ?? null,
      location: (contactData.contact_minimal_street as string) ?? null,
      company: (contactData.company_name as string) ?? null,
      company_hubspot_id:
        (contactData.company_hubspot_id as string) ?? null,
      linkedin_url: (contactData.contact_linkedin_url as string) ?? null,
      linkedin_urn: (contactData.contact_linkedin_urn as string) ?? null,
      is_ia_agent_activated:
        firstActivity.IS_CONTACT_IA_AGENT_ACTIVATED ?? false,
      owner_contact: ownerContactData,
    },
    activities: [],
    stats: {
      total_activities: 0,
      by_type: {},
    },
  };

  const uniqueActivities = deduplicateActivities(activities);

  for (const activity of uniqueActivities) {
    const rawDeals = parseJsonField(activity.DEALS) as Deal[] | null;
    const enrichedDeals = Array.isArray(rawDeals)
      ? rawDeals.map((deal) => ({
          deal_hubspot_id: deal.deal_hubspot_id,
          deal_name: deal.deal_name,
          dealstage: deal.deal_stage ?? null,
          deal_closed_date: deal.deal_closed_date,
          deal_created_date: deal.deal_created_date,
          deal_owner_name: deal.deal_owner_name,
          deal_owner_hubspot_id: deal.deal_owner_hubspot_id,
          is_deal_ia_agent_activated: deal.is_deal_ia_agent_activated,
        }))
      : null;

    contactPayload.activities.push({
      activity_id: activity.ACTIVITY_ID,
      activity_type: activity.ACTIVITY_TYPE,
      recorded_on: activity.ACTIVITY_RECORDED_ON,
      direction: activity.ACTIVITY_DIRECTION,
      metadata: parseJsonField(activity.ACTIVITY_METADATA),
      owner_intent: parseJsonField(activity.OWNER_INTENT_HUBSPOT),
      sender: parseJsonField(activity.SENDER),
      deals: enrichedDeals,
    });

    contactPayload.stats.total_activities++;
    const activityType = activity.ACTIVITY_TYPE ?? "unknown";
    contactPayload.stats.by_type[activityType] =
      (contactPayload.stats.by_type[activityType] ?? 0) + 1;
  }

  return contactPayload;
}

// ============================================
// LANGGRAPH API
// ============================================
async function sendToLangGraph(
  payload: ContactPayload
): Promise<{
  success: boolean;
  runId?: string;
  error?: string;
  statusCode?: number;
}> {
  const baseUrl = process.env.LANGGRAPH_BASE_URL ?? "";
  const apiKey = process.env.LANGGRAPH_API_KEY ?? "";

  if (!baseUrl || !apiKey) {
    return {
      success: false,
      error: "LANGGRAPH_BASE_URL or LANGGRAPH_API_KEY not configured",
    };
  }

  try {
    const res = await fetch(`${baseUrl}/runs`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistant_id: LANGGRAPH_ASSISTANT_ID,
        input: { contact_data: payload },
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { run_id?: string };
      return { success: true, runId: data.run_id };
    } else {
      const text = await res.text();
      return {
        success: false,
        error: `HTTP ${res.status}: ${text.substring(0, 300)}`,
        statusCode: res.status,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ============================================
// SLACK RECAP
// ============================================
interface SlackRecapInput {
  batchId: string;
  ownerStats: Map<string, OwnerStats>;
  noOwnerSkipped: number;
  totalSent: number;
  totalErrors: number;
}

async function sendSlackRecap(data: SlackRecapInput): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) return;

  const now = new Date();
  const dateStr = now.toISOString().substring(0, 10);
  const timeStr = now.toISOString().substring(11, 16);

  const status = data.totalErrors > 0 ? "⚠️" : "✅";
  let message = `[Send Contacts to LangGraph] ${status} — ${dateStr} ${timeStr}\n\n`;

  for (const [, stats] of data.ownerStats) {
    message += `👤 *${stats.ownerName}*\n`;
    message += `• ${stats.totalEligible} éligibles | ${stats.cooldownSkipped} cooldown (< ${COOLDOWN_DAYS}j)\n`;
    message += `• T1 (deal actif): ${stats.tier1} | T2: ${stats.tier2}\n`;
    message += `• ${stats.sent} envoyés / ${MAX_CONTACTS_PER_OWNER} max`;
    if (stats.errored > 0) message += ` | ${stats.errored} erreurs`;
    if (stats.remaining > 0) message += ` | ${stats.remaining} en attente`;
    message += `\n\n`;
  }

  if (data.noOwnerSkipped > 0) {
    message += `⏭️ ${data.noOwnerSkipped} contacts sans owner (skippés)\n\n`;
  }

  message += `📊 *Total*: ${data.totalSent} envoyés | ${data.totalErrors} erreurs`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    logger.error("Failed to send Slack recap", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
