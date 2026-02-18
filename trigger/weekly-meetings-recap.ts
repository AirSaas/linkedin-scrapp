import { logger, schedules } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sleep, sendErrorToScriptLogs } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const HUBSPOT_API_BASE = "https://api.hubapi.com";
const PIPELINE_SQL = "3165468";

const RATE_LIMIT = {
  BETWEEN_CALLS: 100,
  HUBSPOT_429_PAUSE: 10000,
};

const DEALSTAGE_MAP: Record<string, string> = {
  "3165469": "Rendez-vous a planifier",
  "4761722": "Demo planifiée",
  "53408106": "No Show - retry",
  "1014381320": "N-1 Champion paradigme in process",
  "156812060": "Executive à attraper avec le champion",
  "949675659": "Standby",
  "190180115": "ABM pour attraper l'executive",
  "3165470": "1-1 Executive attrapé",
  "140572552": "Go Meeting Pro2LT Avant vente",
  "3165471": "Présentation Equipe planifié",
  "3165472": "1-1 Executive Debrief",
  "19720555": "Go Meeting Pro2LT Vente",
  "1014381321": "Présentation planning accompagnement",
  "3165473": "GO !",
  "3165474": "Fermé gagné",
  "3165475": "Fermé perdu",
  "7278322": "Not MQL Well Qualified",
  "140572553": "Lost - To nurture",
  "140572554": "Ghosting to nurture",
  "140572555": "Lost no nurture (not qualified)",
  "140572556": "Choose direct competitor",
  "24536857": "A supprimer",
  "65426537": "1er contact et marque d'intérêt",
  "65426538": "Démo Airsaas",
  "103274363": "Test en cours",
  "65426539": "1er use case avec un client",
  "94590291": "Formalisation partenariat",
  "65426541": "Co business",
  "65426540": "Co marketing",
  "65426542": "ça patine",
  "65426543": "No GO Pas d'intérêt",
};

const DAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

// ============================================
// TYPES
// ============================================
interface MeetingData {
  time: string;
  dealName: string;
  companyName: string;
  amount: number | null;
  stage: string;
  owner: string;
}

interface DayData {
  dayLabel: string;
  meetings: MeetingData[];
  totalAmount: number;
}

interface WeekData {
  weekLabel: string;
  days: DayData[];
  totalAmount: number;
  totalMeetings: number;
}

interface HubSpotMeeting {
  id: string;
  properties: {
    hs_timestamp?: string;
    hs_meeting_title?: string;
    hubspot_owner_id?: string;
    hs_meeting_start_time?: string;
    hs_meeting_end_time?: string;
  };
}

// ============================================
// SCHEDULED TASK
// ============================================
export const weeklyMeetingsRecapTask = schedules.task({
  id: "weekly-meetings-recap",
  maxDuration: 300,
  run: async () => {
    logger.info("=== START weekly-meetings-recap ===");
    try {

    // Step 1 — Calculate week boundaries (Europe/Paris)
    const { mondayMs, fridayMs, weekLabel, dayDates } = getWeekBounds();
    logger.info(`Week: ${weekLabel} (${new Date(mondayMs).toISOString()} → ${new Date(fridayMs).toISOString()})`);

    // Step 2 — Fetch meetings
    const meetings = await fetchMeetings(mondayMs, fridayMs);
    logger.info(`${meetings.length} meetings found`);

    if (meetings.length === 0) {
      await sendSlackMessage(
        `<!channel>\nAucun meeting SQL cette semaine 🏖️\n\n_${weekLabel}_`
      );
      logger.info("No meetings, sent empty recap");
      return { success: true, meetings: 0 };
    }

    // Step 3+4 — Get deal associations, filter by pipeline SQL
    const meetingsWithDeals = await filterMeetingsByPipeline(meetings);
    logger.info(
      `${meetingsWithDeals.length} meetings in pipeline SQL after filtering`
    );

    if (meetingsWithDeals.length === 0) {
      await sendSlackMessage(
        `<!channel>\nAucun meeting SQL cette semaine 🏖️\n\n_${weekLabel}_`
      );
      logger.info("No SQL pipeline meetings, sent empty recap");
      return { success: true, meetings: 0 };
    }

    // Step 5 — Enrich with company names
    await enrichWithCompanies(meetingsWithDeals);

    // Step 6 — Resolve owners
    const ownerIds = new Set<string>();
    for (const m of meetingsWithDeals) {
      if (m.meeting.properties.hubspot_owner_id) {
        ownerIds.add(m.meeting.properties.hubspot_owner_id);
      }
    }
    const ownersMap = await resolveOwners([...ownerIds]);
    logger.info(`Resolved ${ownersMap.size} owners`);

    // Step 7+8 — Build structured data by day
    const weekData = buildWeekData(
      meetingsWithDeals,
      ownersMap,
      weekLabel,
      dayDates
    );

    // Step 9 — Call Anthropic Sonnet for recap
    const slackMessage = await generateRecap(weekData);

    // Step 10 — Send to Slack
    await sendSlackMessage(`<!channel>\n${slackMessage}`);

    const summary = {
      success: true,
      meetings: weekData.totalMeetings,
      totalAmount: weekData.totalAmount,
    };
    logger.info("=== SUMMARY ===", summary);
    return summary;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Fatal error: ${msg}`);
      await sendErrorToScriptLogs("Weekly Meetings Recap", [{
        label: "Exécution",
        inserted: 0,
        skipped: 0,
        errors: [{ type: "Fatal", code: "exception", message: msg }],
      }]);
      throw err;
    }
  },
});

// ============================================
// WEEK BOUNDS (Europe/Paris)
// ============================================
function getWeekBounds() {
  const parisFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  const now = new Date();

  // Get current date in Paris timezone
  const parisParts = parisFormatter.formatToParts(now);
  const year = parseInt(
    parisParts.find((p) => p.type === "year")!.value,
    10
  );
  const month = parseInt(
    parisParts.find((p) => p.type === "month")!.value,
    10
  );
  const day = parseInt(
    parisParts.find((p) => p.type === "day")!.value,
    10
  );

  // Create a date object for today in Paris
  const todayParis = new Date(
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00+01:00`
  );
  const dayOfWeek = todayParis.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(todayParis);
  monday.setDate(monday.getDate() + diffToMonday);

  // Build day dates for Mon-Fri
  const dayDates: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    dayDates.push(d);
  }

  // Monday 00:00:00 Paris → epoch ms
  const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}T00:00:00`;
  const mondayMs = dateInParis(mondayStr).getTime();

  // Friday 23:59:59 Paris → epoch ms
  const friday = dayDates[4];
  const fridayStr = `${friday.getFullYear()}-${String(friday.getMonth() + 1).padStart(2, "0")}-${String(friday.getDate()).padStart(2, "0")}T23:59:59`;
  const fridayMs = dateInParis(fridayStr).getTime();

  const monthNames = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const weekLabel = `Semaine du ${monday.getDate()} ${monthNames[monday.getMonth()]} ${monday.getFullYear()}`;

  return { mondayMs, fridayMs, weekLabel, dayDates };
}

function dateInParis(localDateTimeStr: string): Date {
  // Determine if date is in CET (+01:00) or CEST (+02:00)
  // Simplified: CEST is last Sunday of March → last Sunday of October
  const d = new Date(localDateTimeStr + "+01:00"); // assume CET
  const month = d.getMonth(); // 0-indexed
  if (month >= 3 && month <= 9) {
    // Possibly CEST (April to September is always CEST)
    if (month >= 4 && month <= 8) {
      return new Date(localDateTimeStr + "+02:00");
    }
    // March or October: check if after last Sunday
    const lastDay = new Date(d.getFullYear(), month + 1, 0).getDate();
    const lastSunday =
      lastDay - ((new Date(d.getFullYear(), month, lastDay).getDay()) % 7);
    if (
      (month === 3 && d.getDate() >= lastSunday) ||
      (month === 9 && d.getDate() < lastSunday)
    ) {
      return new Date(localDateTimeStr + "+02:00");
    }
  }
  return new Date(localDateTimeStr + "+01:00");
}

// ============================================
// HUBSPOT API HELPERS
// ============================================
async function callHubSpot(
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
      const backoff = attempt === 1 ? 1000 : 3000;
      logger.warn(`HubSpot retry ${attempt}/${retries}, waiting ${backoff}ms`);
      await sleep(backoff);
    }

    const res = await fetch(url, options);

    if (res.status === 429) {
      logger.warn("HubSpot rate limit 429, pausing 10s...");
      await sleep(RATE_LIMIT.HUBSPOT_429_PAUSE);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      if (attempt < retries) {
        logger.warn(`HubSpot ${res.status}, retrying: ${text.substring(0, 200)}`);
        continue;
      }
      throw new Error(`HTTP ${res.status}: ${text.substring(0, 300)}`);
    }

    const text = await res.text();
    return text.length > 0 ? JSON.parse(text) : {};
  }

  throw new Error(`HubSpot call failed after ${retries} retries`);
}

// ============================================
// STEP 2 — FETCH MEETINGS
// ============================================
async function fetchMeetings(
  fromMs: number,
  toMs: number
): Promise<HubSpotMeeting[]> {
  const allMeetings: HubSpotMeeting[] = [];
  let after: string | null = null;

  do {
    const body: Record<string, unknown> = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: "hs_timestamp",
              operator: "GTE",
              value: String(fromMs),
            },
            {
              propertyName: "hs_timestamp",
              operator: "LTE",
              value: String(toMs),
            },
          ],
        },
      ],
      properties: [
        "hs_timestamp",
        "hs_meeting_title",
        "hubspot_owner_id",
        "hs_meeting_start_time",
        "hs_meeting_end_time",
      ],
      limit: 100,
      sorts: [
        { propertyName: "hs_timestamp", direction: "ASCENDING" },
      ],
    };

    if (after) body.after = after;

    const response = await callHubSpot(
      `${HUBSPOT_API_BASE}/crm/v3/objects/meetings/search`,
      "POST",
      body
    );

    const results = (response.results ?? []) as HubSpotMeeting[];
    allMeetings.push(...results);

    const paging = response.paging as
      | { next?: { after?: string } }
      | undefined;
    after = paging?.next?.after ?? null;

    await sleep(RATE_LIMIT.BETWEEN_CALLS);
  } while (after);

  return allMeetings;
}

// ============================================
// STEP 3+4 — FILTER BY PIPELINE SQL
// ============================================
interface MeetingWithDeal {
  meeting: HubSpotMeeting;
  dealId: string;
  dealName: string;
  amount: number | null;
  dealStage: string;
  companyName: string;
}

async function filterMeetingsByPipeline(
  meetings: HubSpotMeeting[]
): Promise<MeetingWithDeal[]> {
  const results: MeetingWithDeal[] = [];

  // Process in batches of 10 for parallelization
  for (let i = 0; i < meetings.length; i += 10) {
    const batch = meetings.slice(i, i + 10);

    const batchResults = await Promise.all(
      batch.map(async (meeting) => {
        try {
          // Get deal associations
          const assocResponse = await callHubSpot(
            `${HUBSPOT_API_BASE}/crm/v4/objects/meetings/${meeting.id}/associations/deals`,
            "GET"
          );

          const assocResults = (assocResponse.results ?? []) as {
            toObjectId?: string;
          }[];
          if (assocResults.length === 0) return null;

          const dealId = assocResults[0].toObjectId;
          if (!dealId) return null;

          await sleep(RATE_LIMIT.BETWEEN_CALLS);

          // Get deal properties
          const dealResponse = await callHubSpot(
            `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=dealname,amount,dealstage,pipeline,hubspot_owner_id`,
            "GET"
          );

          const dealProps = (dealResponse.properties ?? {}) as Record<
            string,
            string
          >;

          // Filter by pipeline SQL
          if (dealProps.pipeline !== PIPELINE_SQL) return null;

          return {
            meeting,
            dealId,
            dealName: dealProps.dealname ?? "Deal sans nom",
            amount: dealProps.amount ? parseFloat(dealProps.amount) : null,
            dealStage:
              DEALSTAGE_MAP[dealProps.dealstage] ?? dealProps.dealstage ?? "Inconnu",
            companyName: "",
          } as MeetingWithDeal;
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          logger.error(`Error processing meeting ${meeting.id}: ${m}`);
          return null;
        }
      })
    );

    results.push(
      ...(batchResults.filter(Boolean) as MeetingWithDeal[])
    );

    await sleep(RATE_LIMIT.BETWEEN_CALLS);
  }

  return results;
}

// ============================================
// STEP 5 — ENRICH WITH COMPANY
// ============================================
async function enrichWithCompanies(
  meetingsWithDeals: MeetingWithDeal[]
): Promise<void> {
  for (let i = 0; i < meetingsWithDeals.length; i += 10) {
    const batch = meetingsWithDeals.slice(i, i + 10);

    await Promise.all(
      batch.map(async (mwd) => {
        try {
          const assocResponse = await callHubSpot(
            `${HUBSPOT_API_BASE}/crm/v4/objects/deals/${mwd.dealId}/associations/companies`,
            "GET"
          );

          const assocResults = (assocResponse.results ?? []) as {
            toObjectId?: string;
          }[];
          if (assocResults.length === 0) {
            mwd.companyName = "Entreprise non renseignée";
            return;
          }

          const companyId = assocResults[0].toObjectId;
          if (!companyId) {
            mwd.companyName = "Entreprise non renseignée";
            return;
          }

          await sleep(RATE_LIMIT.BETWEEN_CALLS);

          const companyResponse = await callHubSpot(
            `${HUBSPOT_API_BASE}/crm/v3/objects/companies/${companyId}?properties=name`,
            "GET"
          );

          const companyProps = (companyResponse.properties ?? {}) as Record<
            string,
            string
          >;
          mwd.companyName = companyProps.name ?? "Entreprise non renseignée";
        } catch (err) {
          const m = err instanceof Error ? err.message : String(err);
          logger.warn(`Error enriching company for deal ${mwd.dealId}: ${m}`);
          mwd.companyName = "Entreprise non renseignée";
        }
      })
    );

    await sleep(RATE_LIMIT.BETWEEN_CALLS);
  }
}

// ============================================
// STEP 6 — RESOLVE OWNERS
// ============================================
async function resolveOwners(
  ownerIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const ownerId of ownerIds) {
    try {
      const response = await callHubSpot(
        `${HUBSPOT_API_BASE}/crm/v3/owners/${ownerId}`,
        "GET"
      );

      const firstName = (response.firstName as string) ?? "";
      const lastName = (response.lastName as string) ?? "";
      map.set(ownerId, `${firstName} ${lastName}`.trim() || "Inconnu");

      await sleep(RATE_LIMIT.BETWEEN_CALLS);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      logger.warn(`Error resolving owner ${ownerId}: ${m}`);
      map.set(ownerId, "Inconnu");
    }
  }

  return map;
}

// ============================================
// STEP 7+8 — BUILD WEEK DATA
// ============================================
function buildWeekData(
  meetingsWithDeals: MeetingWithDeal[],
  ownersMap: Map<string, string>,
  weekLabel: string,
  dayDates: Date[]
): WeekData {
  const days: DayData[] = dayDates.map((date, i) => ({
    dayLabel: `${DAY_LABELS[i]} ${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`,
    meetings: [],
    totalAmount: 0,
  }));

  for (const mwd of meetingsWithDeals) {
    const timestamp =
      mwd.meeting.properties.hs_meeting_start_time ??
      mwd.meeting.properties.hs_timestamp;
    if (!timestamp) continue;

    const meetingDate = new Date(timestamp);

    // Convert to Paris time for display
    const parisTime = meetingDate.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const timeFormatted = parisTime.replace(":", "h");

    // Determine which day (0=Mon, 4=Fri)
    const parisDayStr = meetingDate.toLocaleDateString("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const [dd, mm, yyyy] = parisDayStr.split("/").map(Number);
    const meetingDayDate = new Date(yyyy, mm - 1, dd);
    const meetingDow = meetingDayDate.getDay();
    const dayIndex = meetingDow === 0 ? -1 : meetingDow - 1; // Mon=0, Fri=4

    if (dayIndex < 0 || dayIndex > 4) continue; // skip weekends

    const ownerId = mwd.meeting.properties.hubspot_owner_id ?? "";
    const ownerName = ownersMap.get(ownerId) ?? "Inconnu";

    const meetingData: MeetingData = {
      time: timeFormatted,
      dealName: mwd.dealName,
      companyName: mwd.companyName,
      amount: mwd.amount,
      stage: mwd.dealStage,
      owner: ownerName,
    };

    days[dayIndex].meetings.push(meetingData);
    if (mwd.amount) {
      days[dayIndex].totalAmount += mwd.amount;
    }
  }

  const totalAmount = days.reduce((sum, d) => sum + d.totalAmount, 0);
  const totalMeetings = days.reduce((sum, d) => sum + d.meetings.length, 0);

  return { weekLabel, days, totalAmount, totalMeetings };
}

// ============================================
// STEP 9 — ANTHROPIC SONNET RECAP
// ============================================
const SYSTEM_PROMPT = `Tu es un assistant commercial qui produit des récaps hebdomadaires de meetings pour une équipe de vente SaaS B2B.

Tu reçois un JSON structuré avec les meetings de la semaine groupés par jour.

Produis un message Slack bien formaté avec :
1. Un titre avec la semaine concernée
2. Pour chaque jour (lundi à vendredi) :
   - Liste des meetings avec : heure, entreprise, nom du deal, stage, montant (ou "non renseigné"), owner entre parenthèses
   - Total du jour
3. Les jours sans meeting : une mention courte ("Aucun meeting SQL")
4. Un total semaine (montant + nombre de meetings)
5. Un commentaire intelligent de 1-2 lignes max : points saillants (gros deals, concentration de meetings, stages avancés proches du closing, jours chargés/vides, etc.)

Règles de formatage Slack :
- Utilise *gras* pour les titres de jours et les montants importants
- Utilise des émojis sobrement (📅 pour le titre, 💰 pour le total, 💡 pour le commentaire)
- Formate les montants en euros avec séparateur de milliers (ex: 45 000€)
- Les heures en format 24h français (9h30, 14h00)
- Pas de blocs de code, pas de markdown links
- Le message doit être lisible sur mobile`;

async function generateRecap(weekData: WeekData): Promise<string> {
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      temperature: 0.3,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Voici les données des meetings de la semaine. Produis le récap Slack.\n\n${JSON.stringify(weekData, null, 2)}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") {
      return textBlock.text;
    }

    logger.warn("Anthropic returned no text, falling back to static template");
    return buildStaticRecap(weekData);
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    logger.error(`Anthropic API error: ${m}`);

    // Retry once
    try {
      await sleep(2000);
      const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Voici les données des meetings de la semaine. Produis le récap Slack.\n\n${JSON.stringify(weekData, null, 2)}`,
          },
        ],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        return textBlock.text;
      }
    } catch (retryErr) {
      const rm = retryErr instanceof Error ? retryErr.message : String(retryErr);
      logger.error(`Anthropic retry failed: ${rm}`);
    }

    // Fallback to static template
    logger.warn("Using static template fallback");
    return buildStaticRecap(weekData);
  }
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("fr-FR").replace(/\u202F/g, " ") + "€";
}

function buildStaticRecap(weekData: WeekData): string {
  const lines: string[] = [];
  lines.push(`📅 *Récap meetings SQL — ${weekData.weekLabel}*\n`);

  for (const day of weekData.days) {
    lines.push(`*${day.dayLabel}*`);
    if (day.meetings.length === 0) {
      lines.push("Aucun meeting SQL");
    } else {
      for (const m of day.meetings) {
        const amountStr =
          m.amount !== null ? formatAmount(m.amount) : "_non renseigné_";
        lines.push(
          `• ${m.time} — ${m.companyName} — ${m.stage} — ${amountStr} — (${m.owner})`
        );
      }
      lines.push(`→ *Total ${day.dayLabel.split(" ")[0].toLowerCase()} : ${formatAmount(day.totalAmount)}*`);
    }
    lines.push("");
  }

  lines.push(
    `💰 *Total semaine : ${formatAmount(weekData.totalAmount)} (${weekData.totalMeetings} meetings)*`
  );

  return lines.join("\n");
}

// ============================================
// STEP 10 — SLACK WEBHOOK
// ============================================
async function sendSlackMessage(text: string): Promise<void> {
  const webhookUrl = process.env.webhook_sql_activity;
  if (!webhookUrl) {
    logger.error("webhook_sql_activity not configured");
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      logger.info("Slack message sent successfully");
    } else {
      const body = await res.text();
      logger.error(`Slack webhook failed: ${res.status} — ${body}`);
    }
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    logger.error(`Slack webhook error: ${m}`);
  }
}
