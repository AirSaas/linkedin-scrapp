import { task, logger } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { getAiAeSdrSupabase } from "./lib/ai-ae-sdr-supabase.js";
import { callHubSpot } from "./lib/hubspot.js";
import {
  sleep,
  sendErrorToScriptLogs,
  type TaskError,
  type TaskResultGroup,
} from "./lib/utils.js";
import {
  AIRSAAS_CONTEXT,
  SIGNAL_CONFIGS,
  RED_FLAG_LLM_CONFIGS,
  DETERMINISTIC_RED_FLAGS,
  buildUserMessage,
  type SignalResult,
  type RedFlagResult,
  type DealActivity,
  type ContactActivity,
  type HistoryEntry,
} from "./lib/deal-scoring-prompts.js";
import {
  ensureHubSpotProperties,
  updateDealScoring,
  createScoringNote,
  type ScoringResult,
} from "./lib/deal-scoring-hubspot.js";

// ============================================
// CONFIGURATION
// ============================================

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 150_000; // ~150K tokens estimated via chars/4
const BETWEEN_CALLS = 150;

function makeError(msg: string): TaskError {
  return { type: "scoring", code: "SCORING_ERROR", message: msg };
}

// ============================================
// MAIN TASK
// ============================================

export const scoreDealForecastTask = task({
  id: "score-deal-forecast",
  maxDuration: 1800,
  run: async (payload: { deal_urls: string[] }) => {
    const { deal_urls } = payload;
    if (!deal_urls || deal_urls.length === 0) {
      logger.info("No deal URLs provided, exiting");
      return { deals: [], errors: [] };
    }

    // Parse deal IDs from URLs
    const dealEntries: { url: string; dealId: string }[] = [];
    for (const url of deal_urls) {
      const dealId = parseDealId(url);
      if (dealId) {
        dealEntries.push({ url, dealId });
      } else {
        logger.warn(`Invalid deal URL skipped: ${url}`);
      }
    }

    if (dealEntries.length === 0) {
      logger.warn("No valid deal URLs found");
      await sendSlackRecap([], [makeError("Aucun deal URL valide dans le payload")]);
      return { deals: [], errors: ["No valid deal URLs"] };
    }

    logger.info(`Processing ${dealEntries.length} deal(s)`);

    // Ensure HubSpot properties exist (once per run)
    await ensureHubSpotProperties();

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = getAiAeSdrSupabase();
    const results: ScoringResult[] = [];
    const errors: TaskError[] = [];

    // Process deals sequentially to avoid rate limits
    for (const { url, dealId } of dealEntries) {
      try {
        logger.info(`--- Scoring deal ${dealId} ---`);

        // 2a. Fetch data in parallel
        const [activities, contactActivities, dealData] = await Promise.all([
          fetchDealActivities(supabase, dealId),
          fetchContactActivities(supabase, dealId),
          fetchDealWithHistory(dealId),
        ]);

        if (activities.length === 0) {
          logger.warn(`No activities found for deal ${dealId}, skipping`);
          errors.push(makeError(`Deal ${dealId}: aucune activité trouvée`));
          continue;
        }

        // Extract deal info
        const dealName =
          (dealData.properties as Record<string, string>)?.dealname ?? `Deal ${dealId}`;
        const dealStage =
          (dealData.properties as Record<string, string>)?.dealstage ?? "";
        const dealOwnerHubspotId =
          (dealData.properties as Record<string, string>)?.hubspot_owner_id ?? "";
        const dealOwnerName = activities[0]?.DEAL_OWNER_NAME ?? dealOwnerHubspotId;

        // 2c. Format activities for LLM
        const activitiesFormatted = formatActivitiesForLLM(activities);
        const contactsFormatted = formatContactsForLLM(activities, contactActivities);
        const { text: userMessage, truncated } = buildTruncatedUserMessage(
          dealName,
          dealStage,
          dealOwnerName,
          activitiesFormatted,
          contactsFormatted
        );

        if (truncated) {
          logger.info(
            `Activities truncated for deal ${dealId}: ${activities.length} activities`
          );
        }

        logger.info(
          `Deal ${dealId}: ${activities.length} activities, ${contactActivities.length} contact activities`
        );

        // 2d. Score 8 signals in parallel
        const signalResults = await Promise.all(
          SIGNAL_CONFIGS.map((config) =>
            scoreSignal(anthropic, config.signalName, config.systemPrompt, userMessage)
          )
        );

        // 2e. Evaluate red flags: 4 LLM + 2 deterministic
        const stageHistory = extractHistory(dealData, "dealstage");
        const closeDateHistory = extractHistory(dealData, "closedate");

        const [llmRedFlagResults, rfDealZombie, rfCloseDatePushed] = await Promise.all([
          Promise.all(
            RED_FLAG_LLM_CONFIGS.map((config) =>
              evaluateRedFlag(
                anthropic,
                config.flagName,
                config.systemPrompt,
                userMessage
              )
            )
          ),
          Promise.resolve(checkDealZombie(stageHistory)),
          Promise.resolve(checkCloseDatePushed(closeDateHistory)),
        ]);

        // 2f. Aggregate
        const allRedFlags = [
          {
            flagName: "deal_zombie",
            triggered: rfDealZombie.red_flag_triggered,
            malus: DETERMINISTIC_RED_FLAGS[0].malus,
            justification: rfDealZombie.justification,
          },
          {
            flagName: "close_date_pushed",
            triggered: rfCloseDatePushed.red_flag_triggered,
            malus: DETERMINISTIC_RED_FLAGS[1].malus,
            justification: rfCloseDatePushed.justification,
          },
          ...llmRedFlagResults.map((rf, i) => ({
            flagName: RED_FLAG_LLM_CONFIGS[i].flagName,
            triggered: rf.red_flag_triggered,
            malus: RED_FLAG_LLM_CONFIGS[i].malus,
            justification: rf.justification,
          })),
        ];

        const signals = signalResults.map((sr, i) => ({
          signalName: SIGNAL_CONFIGS[i].signalName,
          hubspotProperty: SIGNAL_CONFIGS[i].hubspotProperty,
          score: sr.score,
          justification: sr.justification,
          verbatims: sr.verbatims,
        }));

        const scoreRaw = signals.reduce((sum, s) => sum + s.score, 0);
        const totalMalus = allRedFlags
          .filter((rf) => rf.triggered)
          .reduce((sum, rf) => sum + rf.malus, 0);
        const scoreAdjusted = Math.max(0, scoreRaw - totalMalus);
        const closingPct = Math.round((scoreAdjusted / 32) * 100);
        const zone: "ROUGE" | "ORANGE" | "VERT" =
          scoreAdjusted <= 10 ? "ROUGE" : scoreAdjusted <= 21 ? "ORANGE" : "VERT";

        const scoredAt = new Date().toISOString();

        const scoring: ScoringResult = {
          dealId,
          dealName,
          dealStage,
          dealOwnerName,
          signals,
          redFlags: allRedFlags,
          scoreRaw,
          totalMalus,
          scoreAdjusted,
          closingPct,
          zone,
          scoredAt,
        };

        logger.info(
          `Deal ${dealId} scored: ${scoreAdjusted}/32 (${closingPct}%) — ${zone}`
        );

        // 2g. Write results in parallel
        await Promise.all([
          saveScoringToSupabase(supabase, scoring, activities, userMessage, payload),
          updateDealScoring(dealId, scoring),
          createScoringNote(dealId, scoring),
        ]);

        // 2h. Reset score_now to empty (so Zapier doesn't re-trigger)
        await resetScoreNow(dealId);

        results.push(scoring);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Error scoring deal ${dealId}: ${msg}`);
        errors.push(makeError(`Deal ${dealId}: ${msg}`));
      }
    }

    // 3. Slack recap
    await sendSlackRecap(results, errors);

    if (errors.length > 0) {
      await sendErrorToScriptLogs("Score Deal Forecast", [
        { label: "Scoring", inserted: results.length, skipped: 0, errors },
      ]);
    }

    return {
      deals: results.map((r) => ({
        dealId: r.dealId,
        dealName: r.dealName,
        score: r.scoreAdjusted,
        zone: r.zone,
        closingPct: r.closingPct,
      })),
      errors: errors.map((e) => e.message),
    };
  },
});

// ============================================
// URL PARSING
// ============================================

export function parseDealId(url: string): string | null {
  const match = url.match(/record\/0-3\/(\d+)/);
  return match ? match[1] : null;
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchDealActivities(
  supabase: ReturnType<typeof getAiAeSdrSupabase>,
  dealId: string
): Promise<DealActivity[]> {
  const { data, error } = await supabase
    .from("PRC_DEAL_ACTIVITIES")
    .select("*")
    .eq("DEAL_HUBSPOT_ID", dealId)
    .order("ACTIVITY_RECORDED_ON", { ascending: true });

  if (error) {
    logger.error(`Supabase PRC_DEAL_ACTIVITIES error: ${error.message}`);
    return [];
  }
  return (data ?? []) as DealActivity[];
}

async function fetchContactActivities(
  supabase: ReturnType<typeof getAiAeSdrSupabase>,
  dealId: string
): Promise<ContactActivity[]> {
  // DEALS is a JSON field — use textSearch or ilike
  const { data, error } = await supabase
    .from("PRC_CONTACT_ACTIVITIES")
    .select(
      "CONTACT_FULL_NAME, CONTACT, ACTIVITY_TYPE, ACTIVITY_RECORDED_ON"
    )
    .ilike("DEALS", `%${dealId}%`);

  if (error) {
    logger.error(`Supabase PRC_CONTACT_ACTIVITIES error: ${error.message}`);
    return [];
  }

  // Deduplicate contacts
  const seen = new Set<string>();
  const unique: ContactActivity[] = [];
  for (const row of data ?? []) {
    const name = (row as ContactActivity).CONTACT_FULL_NAME;
    if (!seen.has(name)) {
      seen.add(name);
      unique.push(row as ContactActivity);
    }
  }
  return unique;
}

async function fetchDealWithHistory(
  dealId: string
): Promise<Record<string, unknown>> {
  const url =
    `https://api.hubapi.com/crm/v3/objects/deals/${dealId}` +
    `?propertiesWithHistory=dealstage,closedate` +
    `&properties=dealname,amount,dealstage,closedate,pipeline,hubspot_owner_id`;
  return callHubSpot(url, "GET");
}

function extractHistory(
  dealData: Record<string, unknown>,
  propertyName: string
): HistoryEntry[] {
  const pwh = dealData.propertiesWithHistory as
    | Record<string, HistoryEntry[]>
    | undefined;
  if (!pwh || !pwh[propertyName]) return [];
  return pwh[propertyName];
}

// ============================================
// FORMATTING FOR LLM
// ============================================

function formatActivitiesForLLM(activities: DealActivity[]): string {
  return activities
    .map((a) => {
      const date = a.ACTIVITY_RECORDED_ON?.split("T")[0] ?? "?";
      const type = a.ACTIVITY_TYPE ?? "?";
      const direction = a.ACTIVITY_DIRECTION ?? "";
      const dirStr = direction ? ` (${direction})` : "";

      // Parse sender
      let senderName = "?";
      if (a.SENDER) {
        const sender =
          typeof a.SENDER === "string" ? safeParseJSON(a.SENDER) : a.SENDER;
        if (sender && typeof sender === "object") {
          senderName =
            (sender as Record<string, unknown>).sender_name as string ??
            (sender as Record<string, unknown>).full_name as string ??
            "?";
        }
      }

      // Parse contacts
      let contactsStr = "";
      if (a.CONTACTS) {
        const contacts =
          typeof a.CONTACTS === "string"
            ? safeParseJSON(a.CONTACTS)
            : a.CONTACTS;
        if (Array.isArray(contacts)) {
          const names = contacts.map((c: Record<string, unknown>) => {
            const name = c.contact_name ?? c.full_name ?? "?";
            const job = c.contact_job ?? "";
            const role = c.contact_job_strategic_role ?? "";
            const jobStr = [job, role].filter(Boolean).join(", ");
            return jobStr ? `${name} (${jobStr})` : String(name);
          });
          contactsStr = ` — CONTACTS: [${names.join(", ")}]`;
        }
      }

      // Parse body from metadata
      let bodyStr = "";
      if (a.ACTIVITY_METADATA) {
        const meta =
          typeof a.ACTIVITY_METADATA === "string"
            ? safeParseJSON(a.ACTIVITY_METADATA)
            : a.ACTIVITY_METADATA;
        if (meta && typeof meta === "object") {
          const m = meta as Record<string, unknown>;
          const body =
            (m.body as string) ??
            (m.title as string) ??
            (m.meeting_internal_note as string) ??
            (m.hs_note_body as string) ??
            "";
          if (body) {
            // Strip HTML tags and trim
            const clean = body.replace(/<[^>]*>/g, " ").trim();
            bodyStr = ` — ${clean.substring(0, 2000)}`;
          }
        }
      }

      return `[${date}] ${type}${dirStr} — ${senderName}${contactsStr}${bodyStr}`;
    })
    .join("\n");
}

function formatContactsForLLM(
  activities: DealActivity[],
  contactActivities: ContactActivity[]
): string {
  // Build unique contact profiles from activities
  const contactMap = new Map<
    string,
    { name: string; job: string; role: string; count: number }
  >();

  for (const a of activities) {
    if (!a.CONTACTS) continue;
    const contacts =
      typeof a.CONTACTS === "string" ? safeParseJSON(a.CONTACTS) : a.CONTACTS;
    if (!Array.isArray(contacts)) continue;

    for (const c of contacts) {
      const name = String(c.contact_name ?? c.full_name ?? "");
      if (!name) continue;
      const existing = contactMap.get(name);
      if (existing) {
        existing.count++;
      } else {
        contactMap.set(name, {
          name,
          job: String(c.contact_job ?? ""),
          role: String(c.contact_job_strategic_role ?? ""),
          count: 1,
        });
      }
    }
  }

  // Merge contact activities for additional info
  for (const ca of contactActivities) {
    const name = ca.CONTACT_FULL_NAME;
    if (!contactMap.has(name) && ca.CONTACT) {
      const contact =
        typeof ca.CONTACT === "string" ? safeParseJSON(ca.CONTACT) : ca.CONTACT;
      if (contact && typeof contact === "object") {
        const c = contact as Record<string, unknown>;
        contactMap.set(name, {
          name,
          job: String(c.contact_job ?? c.CONTACT_JOB ?? ""),
          role: String(
            c.contact_job_strategic_role ?? c.CONTACT_JOB_STRATEGIC_ROLE ?? ""
          ),
          count: 1,
        });
      }
    }
  }

  if (contactMap.size === 0) return "Aucun contact identifié";

  return Array.from(contactMap.values())
    .sort((a, b) => b.count - a.count)
    .map((c) => {
      const parts = [c.name];
      if (c.job) parts.push(`Poste: ${c.job}`);
      if (c.role) parts.push(`Rôle stratégique: ${c.role}`);
      parts.push(`Activités: ${c.count}`);
      return parts.join(" | ");
    })
    .join("\n");
}

function buildTruncatedUserMessage(
  dealName: string,
  dealStage: string,
  dealOwner: string,
  activitiesFormatted: string,
  contactsFormatted: string
): { text: string; truncated: boolean } {
  let text = buildUserMessage(
    dealName,
    dealStage,
    dealOwner,
    activitiesFormatted,
    contactsFormatted
  );

  const estimatedTokens = text.length / 4;
  if (estimatedTokens <= MAX_TOKENS) {
    return { text, truncated: false };
  }

  // Truncate: keep last 90 days of activities, then cap at 100 activities
  const lines = activitiesFormatted.split("\n");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  let filtered = lines.filter((line) => {
    const dateMatch = line.match(/^\[(\d{4}-\d{2}-\d{2})\]/);
    return dateMatch ? dateMatch[1] >= cutoffStr : true;
  });

  if (filtered.length > 100) {
    filtered = filtered.slice(-100);
  }

  logger.info(
    `Truncated activities: ${lines.length} → ${filtered.length} (90-day window + cap 100)`
  );

  text = buildUserMessage(
    dealName,
    dealStage,
    dealOwner,
    filtered.join("\n"),
    contactsFormatted
  );
  return { text, truncated: true };
}

// ============================================
// LLM SCORING
// ============================================

async function scoreSignal(
  client: Anthropic,
  signalName: string,
  systemPrompt: string,
  userMessage: string
): Promise<SignalResult> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      temperature: 0.2,
      system: `${AIRSAAS_CONTEXT}\n\n${systemPrompt}`,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    return parseSignalResponse(text, signalName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Signal ${signalName} LLM error: ${msg}`);
    return {
      score: 0,
      justification: `Erreur LLM: ${msg.substring(0, 100)}`,
      verbatims: [],
      signal_name: signalName,
    };
  }
}

async function evaluateRedFlag(
  client: Anthropic,
  flagName: string,
  systemPrompt: string,
  userMessage: string
): Promise<RedFlagResult> {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 500,
      temperature: 0.2,
      system: `${AIRSAAS_CONTEXT}\n\n${systemPrompt}`,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    return parseRedFlagResponse(text, flagName);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Red flag ${flagName} LLM error: ${msg}`);
    return {
      red_flag_triggered: false,
      justification: `Erreur LLM: ${msg.substring(0, 100)}`,
      red_flag_name: flagName,
    };
  }
}

// ============================================
// LLM RESPONSE PARSING
// ============================================

function parseSignalResponse(text: string, signalName: string): SignalResult {
  const fallback: SignalResult = {
    score: 0,
    justification: "Erreur LLM: parsing échoué",
    verbatims: [],
    signal_name: signalName,
  };

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    const score = Math.max(0, Math.min(4, Number(parsed.score) || 0));
    const justification = String(parsed.justification ?? "");
    const verbatims = Array.isArray(parsed.verbatims) ? parsed.verbatims : [];

    return {
      score,
      justification,
      verbatims: verbatims.map(String),
      signal_name: parsed.signal_name ?? signalName,
    };
  } catch {
    logger.warn(`Failed to parse signal response for ${signalName}: ${text.substring(0, 200)}`);
    return fallback;
  }
}

function parseRedFlagResponse(text: string, flagName: string): RedFlagResult {
  const fallback: RedFlagResult = {
    red_flag_triggered: false,
    justification: "Erreur LLM: parsing échoué",
    red_flag_name: flagName,
  };

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallback;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      red_flag_triggered: Boolean(parsed.red_flag_triggered),
      justification: String(parsed.justification ?? ""),
      red_flag_name: parsed.red_flag_name ?? flagName,
    };
  } catch {
    logger.warn(`Failed to parse red flag response for ${flagName}: ${text.substring(0, 200)}`);
    return fallback;
  }
}

// ============================================
// DETERMINISTIC RED FLAGS
// ============================================

function checkDealZombie(stageHistory: HistoryEntry[]): RedFlagResult {
  if (stageHistory.length === 0) {
    return {
      red_flag_triggered: false,
      justification: "Pas d'historique de stage disponible",
      red_flag_name: "deal_zombie",
    };
  }

  // Find the most recent stage change
  const sorted = [...stageHistory].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  const lastChange = new Date(sorted[0].timestamp);
  const daysSince = Math.floor(
    (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSince > 45) {
    return {
      red_flag_triggered: true,
      justification: `Dernier changement de stage il y a ${daysSince} jours (seuil: 45j)`,
      red_flag_name: "deal_zombie",
    };
  }

  return {
    red_flag_triggered: false,
    justification: `Dernier changement de stage il y a ${daysSince} jours`,
    red_flag_name: "deal_zombie",
  };
}

function checkCloseDatePushed(closeDateHistory: HistoryEntry[]): RedFlagResult {
  if (closeDateHistory.length <= 1) {
    return {
      red_flag_triggered: false,
      justification:
        closeDateHistory.length === 0
          ? "Pas d'historique de closedate"
          : "Une seule closedate enregistrée",
      red_flag_name: "close_date_pushed",
    };
  }

  // Sort by timestamp ascending to track chronological changes
  const sorted = [...closeDateHistory].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Count pushes (closedate moved to a later date)
  let pushCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].value).getTime();
    const curr = new Date(sorted[i].value).getTime();
    if (curr > prev) {
      pushCount++;
    }
  }

  if (pushCount >= 2) {
    return {
      red_flag_triggered: true,
      justification: `Close date repoussée ${pushCount} fois`,
      red_flag_name: "close_date_pushed",
    };
  }

  return {
    red_flag_triggered: false,
    justification: `Close date repoussée ${pushCount} fois (seuil: 2)`,
    red_flag_name: "close_date_pushed",
  };
}

// ============================================
// SUPABASE AUDIT
// ============================================

async function saveScoringToSupabase(
  supabase: ReturnType<typeof getAiAeSdrSupabase>,
  scoring: ScoringResult,
  activities: DealActivity[],
  userMessage: string,
  payload: { deal_urls: string[] }
): Promise<void> {
  const rfMap = new Map(scoring.redFlags.map((rf) => [rf.flagName, rf.triggered]));

  const { error } = await supabase.from("deal_scoring").insert({
    deal_hubspot_id: scoring.dealId,
    deal_name: scoring.dealName,
    deal_stage: scoring.dealStage,
    deal_owner_name: scoring.dealOwnerName,

    // Individual scores
    decision_maker_access: scoring.signals[0]?.score ?? 0,
    budget_validation: scoring.signals[1]?.score ?? 0,
    urgency_timeline: scoring.signals[2]?.score ?? 0,
    champion_strength: scoring.signals[3]?.score ?? 0,
    pain_fit: scoring.signals[4]?.score ?? 0,
    demo_impact: scoring.signals[5]?.score ?? 0,
    exec_relationship_depth: scoring.signals[6]?.score ?? 0,
    outreach_quality: scoring.signals[7]?.score ?? 0,

    // Aggregates
    forecast_score_raw: scoring.scoreRaw,
    forecast_score: scoring.scoreAdjusted,
    forecast_closing_pct: scoring.closingPct,
    forecast_zone: scoring.zone,

    // Red flags
    rf_deal_zombie: rfMap.get("deal_zombie") ?? false,
    rf_close_date_pushed: rfMap.get("close_date_pushed") ?? false,
    rf_no_clevel_post_demo: rfMap.get("aucun_clevel") ?? false,
    rf_non_decision_maker: rfMap.get("interlocuteur_non_decisionnel") ?? false,
    rf_competitor_unaddressed: rfMap.get("concurrent_non_traite") ?? false,
    rf_discount_no_tradeoff: rfMap.get("discount_sans_contrepartie") ?? false,
    total_malus: scoring.totalMalus,

    // Detail JSON
    signals_detail: scoring.signals,
    red_flags_detail: scoring.redFlags,

    // Audit
    input_activities_count: activities.length,
    input_activities_raw: activities,
    prompts_used: {
      signals: SIGNAL_CONFIGS.map((c) => ({
        name: c.signalName,
        prompt: c.systemPrompt.substring(0, 200) + "...",
      })),
      red_flags: RED_FLAG_LLM_CONFIGS.map((c) => ({
        name: c.flagName,
        prompt: c.systemPrompt.substring(0, 200) + "...",
      })),
    },
    model_used: MODEL,

    // Metadata
    triggered_by: "manual",
    trigger_payload: payload,
  });

  if (error) {
    logger.error(`Supabase deal_scoring insert error: ${error.message}`);
    throw new Error(`Supabase insert failed: ${error.message}`);
  }
  logger.info(`Scoring saved to Supabase for deal ${scoring.dealId}`);
}

// ============================================
// SLACK RECAP
// ============================================

async function sendSlackRecap(
  results: ScoringResult[],
  errors: TaskError[]
): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) return;

  const zoneEmoji: Record<string, string> = {
    ROUGE: "🔴",
    ORANGE: "🟠",
    VERT: "🟢",
  };

  let text = `🎯 *[Deal Scoring Forecast]* — ${new Date().toLocaleDateString("fr-FR")}\n\n`;

  if (results.length > 0) {
    text += `📊 *Résultats (${results.length} deal${results.length > 1 ? "s" : ""})*\n`;
    for (const r of results) {
      const emoji = zoneEmoji[r.zone] ?? "⚪";
      const flags = r.redFlags.filter((rf) => rf.triggered);
      const flagStr =
        flags.length > 0
          ? ` | 🚩 ${flags.map((f) => f.flagName).join(", ")}`
          : "";
      text += `${emoji} *${r.dealName}*: ${r.scoreAdjusted}/32 (${r.closingPct}%) — ${r.zone}${flagStr}\n`;
    }
  }

  if (errors.length > 0) {
    text += `\n❌ *Erreurs (${errors.length})*\n`;
    for (const e of errors) {
      text += `• ${e.message}\n`;
    }
  }

  if (results.length === 0 && errors.length === 0) {
    text += "Aucun deal traité";
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Slack recap failed: ${msg}`);
  }
}

// ============================================
// HELPERS
// ============================================

async function resetScoreNow(dealId: string): Promise<void> {
  try {
    await callHubSpot(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`,
      "PATCH",
      { properties: { score_now: "" } }
    );
    logger.info(`Reset score_now for deal ${dealId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to reset score_now for deal ${dealId}: ${msg}`);
  }
}

function safeParseJSON(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
