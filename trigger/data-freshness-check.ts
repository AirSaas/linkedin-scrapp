import { logger, schedules } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const TABLES = [
  { name: "PRC_INTENT_EVENTS", dateColumn: "EVENT_RECORDED_ON", label: "PRC_INTENT_EVENTS" },
  { name: "scrapped_visit", dateColumn: "created_at", label: "scrapped_visit" },
  { name: "scrapped_reaction", dateColumn: "created_at", label: "scrapped_reaction" },
  { name: "scrapped_linkedin_messages", dateColumn: "created_at", label: "messages" },
  { name: "scrapped_linkedin_threads", dateColumn: "updated_at", label: "threads" },
];

const HISTORY_DAYS = 30;

interface TableResult {
  table: string;
  label: string;
  count: number;
  status: "ok" | "warning" | "anomaly";
  comment: string;
}

// ============================================
// SCHEDULED TASK
// ============================================
export const dataFreshnessCheckTask = schedules.task({
  id: "data-freshness-check",
  maxDuration: 120,
  run: async () => {
    logger.info("=== START data-freshness-check ===");

    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sunday, 1=Monday
    const isMonday = dayOfWeek === 1;

    // Determine check period
    const lookbackDays = isMonday ? 7 : 1;
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - lookbackDays);
    since.setUTCHours(0, 0, 0, 0);

    const periodLabel = isMonday
      ? `7 derniers jours (${since.toISOString().substring(0, 10)} → ${new Date(now.getTime() - 86400000).toISOString().substring(0, 10)})`
      : new Date(now.getTime() - 86400000).toISOString().substring(0, 10);

    logger.info(`Period: ${periodLabel} (${isMonday ? "Monday — 7 days" : "J-1"})`);

    const errors: TaskError[] = [];
    const results: TableResult[] = [];
    const tablesNeedingAI: { table: string; label: string; count: number; history: Record<string, number> }[] = [];

    // Step 1: Get counts for each table
    for (const table of TABLES) {
      try {
        const count = await getTableCount(table.name, table.dateColumn, since);
        logger.info(`${table.name}: ${count} records since ${since.toISOString()}`);

        if (count === 0) {
          // Definite anomaly — find last record date
          const lastDate = await getLastRecordDate(table.name, table.dateColumn);
          results.push({
            table: table.name,
            label: table.label,
            count: 0,
            status: "anomaly",
            comment: lastDate
              ? `aucune donnée depuis le ${lastDate}`
              : "table vide",
          });
        } else {
          // Need historical context for AI evaluation
          const history = await getHistoricalCounts(table.name, table.dateColumn, HISTORY_DAYS);
          tablesNeedingAI.push({ table: table.name, label: table.label, count, history });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Error checking ${table.name}: ${msg}`);
        errors.push({
          type: "Table Check",
          code: "exception",
          message: msg,
          profile: table.name,
        });
        results.push({
          table: table.name,
          label: table.label,
          count: -1,
          status: "anomaly",
          comment: `erreur: ${msg.substring(0, 100)}`,
        });
      }
    }

    // Step 2: AI evaluation for tables with > 0 records
    if (tablesNeedingAI.length > 0) {
      try {
        const aiResults = await evaluateWithAI(tablesNeedingAI, periodLabel, isMonday);
        results.push(...aiResults);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`AI evaluation failed: ${msg}`);
        errors.push({
          type: "AI Evaluation",
          code: "exception",
          message: msg,
        });
        // Fallback: mark all as OK since we can't evaluate
        for (const t of tablesNeedingAI) {
          results.push({
            table: t.table,
            label: t.label,
            count: t.count,
            status: "ok",
            comment: "évaluation IA indisponible",
          });
        }
      }
    }

    // Step 3: Build and send Slack message
    const hasAnomalies = results.some((r) => r.status === "anomaly" || r.status === "warning");
    const message = buildSlackMessage(results, periodLabel, hasAnomalies);
    await sendSlackRecap(message);

    // Step 4: Send internal errors to script_logs if any
    await sendErrorToScriptLogs("Data Freshness Check", [{
      label: "Tables",
      inserted: results.filter((r) => r.status === "ok").length,
      skipped: 0,
      errors,
    }]);

    const summary = {
      success: true,
      period: periodLabel,
      tables: results.map((r) => ({ table: r.table, count: r.count, status: r.status })),
      anomalies: results.filter((r) => r.status !== "ok").length,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// SUPABASE QUERIES
// ============================================
function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_KEY ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "count=exact",
  };
}

function supabaseUrl(table: string): string {
  const base = process.env.SUPABASE_URL ?? "";
  return `${base}/rest/v1/${table}`;
}

async function getTableCount(
  table: string,
  dateColumn: string,
  since: Date
): Promise<number> {
  const url = `${supabaseUrl(table)}?${dateColumn}=gte.${since.toISOString()}&select=${dateColumn}`;
  const res = await fetch(url, { headers: { ...supabaseHeaders(), Prefer: "count=exact" } });

  if (!res.ok) {
    throw new Error(`Supabase ${table}: HTTP ${res.status}`);
  }

  const contentRange = res.headers.get("content-range");
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }

  // Fallback: count the array
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

async function getLastRecordDate(
  table: string,
  dateColumn: string
): Promise<string | null> {
  const url = `${supabaseUrl(table)}?select=${dateColumn}&order=${dateColumn}.desc&limit=1`;
  const res = await fetch(url, { headers: supabaseHeaders() });

  if (!res.ok) return null;

  const data = await res.json();
  if (Array.isArray(data) && data.length > 0) {
    const val = data[0][dateColumn];
    return typeof val === "string" ? val.substring(0, 10) : null;
  }
  return null;
}

async function getHistoricalCounts(
  table: string,
  dateColumn: string,
  days: number
): Promise<Record<string, number>> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  // Fetch all records' dates in the period (just the date column)
  const counts: Record<string, number> = {};
  let offset = 0;
  const pageSize = 1000;

  // Initialize all days to 0
  for (let d = 0; d < days; d++) {
    const date = new Date(since);
    date.setUTCDate(date.getUTCDate() + d);
    counts[date.toISOString().substring(0, 10)] = 0;
  }

  // Count via paginated requests
  while (true) {
    const url = `${supabaseUrl(table)}?${dateColumn}=gte.${since.toISOString()}&select=${dateColumn}&order=${dateColumn}.desc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: supabaseHeaders() });

    if (!res.ok) break;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    for (const row of data) {
      const val = row[dateColumn];
      if (typeof val === "string") {
        const dateKey = val.substring(0, 10);
        if (dateKey in counts) {
          counts[dateKey]++;
        }
      }
    }

    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return counts;
}

// ============================================
// AI EVALUATION
// ============================================
async function evaluateWithAI(
  tables: { table: string; label: string; count: number; history: Record<string, number> }[],
  periodLabel: string,
  isMonday: boolean
): Promise<TableResult[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const tableData = tables.map((t) => ({
    table: t.table,
    current_count: t.count,
    period: periodLabel,
    is_monday_7day_check: isMonday,
    daily_counts_last_30_days: t.history,
  }));

  const prompt = `Voici les counts quotidiens des 30 derniers jours pour des tables Supabase, ainsi que le count sur la période vérifiée aujourd'hui.

Évalue si le count actuel est normal pour chaque table.
Tiens compte des patterns jour de la semaine / weekend (certaines tables ont moins de données le weekend, c'est normal).
${isMonday ? "Aujourd'hui c'est lundi, on vérifie les 7 derniers jours (le total doit correspondre à environ une semaine complète)." : "On vérifie J-1 uniquement."}

Données :
${JSON.stringify(tableData, null, 2)}

Réponds UNIQUEMENT en JSON valide, sans markdown, sans backticks :
[{ "table": "nom", "status": "ok" | "warning" | "anomaly", "comment": "explication courte en français" }]

Critères :
- "ok" = count dans la norme
- "warning" = count significativement plus bas que la moyenne mais pas zéro
- "anomaly" = count très anormalement bas par rapport à l'historique`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b: { type: string }) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Anthropic");
  }

  const aiResults = JSON.parse(textBlock.text) as { table: string; status: "ok" | "warning" | "anomaly"; comment: string }[];

  return tables.map((t) => {
    const ai = aiResults.find((r) => r.table === t.table);
    return {
      table: t.table,
      label: t.label,
      count: t.count,
      status: ai?.status ?? "ok",
      comment: ai?.comment ?? "",
    };
  });
}

// ============================================
// SLACK MESSAGE
// ============================================
function buildSlackMessage(
  results: TableResult[],
  periodLabel: string,
  hasAnomalies: boolean
): string {
  const now = new Date();
  const dateStr = now.toISOString().substring(0, 10);
  const timeStr = now.toISOString().substring(11, 16);

  if (!hasAnomalies) {
    // Light recap when everything is OK
    const counts = results.map((r) => `${r.label}: ${r.count}`).join(" | ");
    return `[Data Freshness Check — Trigger.dev] ✅ — ${dateStr} ${timeStr}\nPériode vérifiée : ${periodLabel}\n• ${counts}`;
  }

  // Detailed recap with anomalies
  let message = `[Data Freshness Check — Trigger.dev] ⚠️ Anomalies — ${dateStr} ${timeStr}\nPériode vérifiée : ${periodLabel}\n`;

  const anomalies = results.filter((r) => r.status === "anomaly" || r.status === "warning");
  const ok = results.filter((r) => r.status === "ok");

  if (anomalies.length > 0) {
    message += "\n❌ Anomalies\n";
    for (const r of anomalies) {
      const emoji = r.status === "anomaly" ? "🔴" : "🟡";
      message += `${emoji} ${r.label}: ${r.count} enregistrements — ${r.comment}\n`;
    }
  }

  if (ok.length > 0) {
    message += "\n✅ OK\n";
    for (const r of ok) {
      message += `• ${r.label}: ${r.count} enregistrements\n`;
    }
  }

  return message;
}

async function sendSlackRecap(message: string): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) {
    logger.warn("script_logs env var not set, skipping recap");
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    logger.info("Slack recap sent");
  } catch (err) {
    logger.error("Failed to send Slack recap", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
