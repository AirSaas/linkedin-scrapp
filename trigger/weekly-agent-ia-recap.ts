import { logger, schedules } from "@trigger.dev/sdk/v3";
import { getAiAeSdrSupabase } from "./lib/ai-ae-sdr-supabase.js";
import { getSupabase } from "./lib/supabase.js";
import { sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";

// ============================================
// TYPES
// ============================================

interface FinalDecisionRow {
  id: number;
  created_at: string;
  status: string;
  owner_name: string | null;
  canal_used: string | null;
  rating: number | null;
  cancelled_reason: string | null;
}

interface OwnerStats {
  ownerName: string;
  slackId: string | null;
  displayName: string;
  total: number;
  sent: number;
  cancelled: number;
  pending: number;
  expired: number;
  nonTraite: number;
  pctSent: number;
  pctCancelled: number;
  pctNonTraite: number;
  canalLinkedin: number;
  canalEmail: number;
  ratingAvg: number | null;
  ratingCount: number;
}

interface WeekBounds {
  startISO: string;
  endISO: string;
  weekLabel: string;
}

// ============================================
// SCHEDULED TASK
// ============================================

export const weeklyAgentIaRecapTask = schedules.task({
  id: "weekly-agent-ia-recap",
  maxDuration: 60,
  run: async () => {
    logger.info("=== START weekly-agent-ia-recap ===");

    try {
      // Step 1 — Compute week bounds
      const currentWeek = getWeekBounds(0);
      const prevWeek = getWeekBounds(1);
      logger.info(`Current: ${currentWeek.weekLabel} (${currentWeek.startISO} → ${currentWeek.endISO})`);
      logger.info(`Previous: ${prevWeek.weekLabel} (${prevWeek.startISO} → ${prevWeek.endISO})`);

      // Step 2 — Fetch data
      const [currentRows, prevRows, slackMapping] = await Promise.all([
        fetchDecisions(currentWeek.startISO, currentWeek.endISO),
        fetchDecisions(prevWeek.startISO, prevWeek.endISO),
        fetchSlackMapping(),
      ]);
      logger.info(`Current week: ${currentRows.length} decisions, Previous: ${prevRows.length}`);

      // Step 3 — Handle empty week
      if (currentRows.length === 0) {
        await postToWebhook(`[Agent IA Recap] 📊 ${currentWeek.weekLabel}\n\n✅ Aucune recommandation cette semaine !`);
        return { success: true, total: 0 };
      }

      // Step 4 — Compute stats
      const currentStats = computeStatsByOwner(currentRows, slackMapping);
      const prevStats = computeStatsByOwner(prevRows, slackMapping);
      const cancelledReasons = computeTopCancelledReasons(currentRows);

      // Step 5 — Build and send Slack message
      const message = buildSlackMessage(currentWeek.weekLabel, currentStats, prevStats, cancelledReasons);
      await postToWebhook(message);

      const summary = {
        success: true,
        total: currentRows.length,
        owners: currentStats.length,
        prevTotal: prevRows.length,
      };
      logger.info("=== SUMMARY ===", summary);
      return summary;
    } catch (err) {
      logger.error("Fatal error in weekly-agent-ia-recap", {
        error: err instanceof Error ? err.message : String(err),
      });
      await sendErrorToScriptLogs("Weekly Agent IA Recap", [{
        label: "Exécution",
        inserted: 0,
        skipped: 0,
        errors: [{
          type: "Fatal",
          code: "UNHANDLED",
          message: err instanceof Error ? err.message : String(err),
        }],
      }]);
      throw err;
    }
  },
});

// ============================================
// WEEK BOUNDS (Europe/Paris)
// ============================================

function getWeekBounds(weeksBack: number): WeekBounds {
  const now = new Date();

  const parisFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const parts = parisFormatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  const weekdayMap: Record<string, number> = {
    lundi: 1, mardi: 2, mercredi: 3, jeudi: 4,
    vendredi: 5, samedi: 6, dimanche: 0,
  };
  const weekdayName = parts.find((p) => p.type === "weekday")!.value.toLowerCase();
  const dayOfWeek = weekdayMap[weekdayName] ?? 0;

  const todayUTC = new Date(Date.UTC(year, month - 1, day));

  // Monday 00:00 of current week
  const diffToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
  const mondayUTC = new Date(todayUTC);
  mondayUTC.setUTCDate(mondayUTC.getUTCDate() + diffToMonday - weeksBack * 7);

  // Friday 12:00 of the same week = Monday + 4 days + 12h
  // But we use 10:00 UTC = 12:00 Paris (CET) or 10:00 UTC (CEST)
  // Use 10:00 UTC as approximation for noon Paris
  const fridayUTC = new Date(mondayUTC);
  fridayUTC.setUTCDate(fridayUTC.getUTCDate() + 4);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startISO = `${mondayUTC.getUTCFullYear()}-${pad(mondayUTC.getUTCMonth() + 1)}-${pad(mondayUTC.getUTCDate())}T00:00:00.000Z`;
  const endISO = `${fridayUTC.getUTCFullYear()}-${pad(fridayUTC.getUTCMonth() + 1)}-${pad(fridayUTC.getUTCDate())}T10:00:00.000Z`;

  const weekLabel = `Semaine du ${pad(mondayUTC.getUTCDate())}/${pad(mondayUTC.getUTCMonth() + 1)} au ${pad(fridayUTC.getUTCDate())}/${pad(fridayUTC.getUTCMonth() + 1)}`;

  return { startISO, endISO, weekLabel };
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchDecisions(startISO: string, endISO: string): Promise<FinalDecisionRow[]> {
  const { data, error } = await getAiAeSdrSupabase()
    .from("final_decision")
    .select("id, created_at, status, owner_name, canal_used, rating, cancelled_reason")
    .gte("created_at", startISO)
    .lt("created_at", endISO)
    .neq("owner_name", "simon_vacher");

  if (error) throw new Error(`Failed to fetch final_decision: ${error.message}`);
  return (data ?? []) as FinalDecisionRow[];
}

async function fetchSlackMapping(): Promise<Map<string, { slackId: string | null; displayName: string }>> {
  const { data, error } = await getSupabase()
    .from("workspace_team")
    .select("firstname, lastname, slack_id");

  if (error) throw new Error(`Failed to fetch workspace_team: ${error.message}`);

  const mapping = new Map<string, { slackId: string | null; displayName: string }>();
  for (const member of data ?? []) {
    if (member.firstname && member.lastname) {
      const key = `${member.firstname.toLowerCase()}_${member.lastname.toLowerCase()}`;
      mapping.set(key, {
        slackId: member.slack_id ?? null,
        displayName: `${member.firstname} ${member.lastname}`,
      });
    }
  }
  return mapping;
}

// ============================================
// STATS COMPUTATION
// ============================================

function computeStatsByOwner(
  rows: FinalDecisionRow[],
  slackMapping: Map<string, { slackId: string | null; displayName: string }>,
): OwnerStats[] {
  const byOwner = new Map<string, FinalDecisionRow[]>();
  for (const row of rows) {
    const key = row.owner_name ?? "__null__";
    const arr = byOwner.get(key) ?? [];
    arr.push(row);
    byOwner.set(key, arr);
  }

  const stats: OwnerStats[] = [];
  for (const [ownerKey, ownerRows] of byOwner) {
    const total = ownerRows.length;
    const sent = ownerRows.filter((r) => r.status === "sent").length;
    const cancelled = ownerRows.filter((r) => r.status === "cancelled").length;
    const pending = ownerRows.filter((r) => r.status === "pending").length;
    const expired = ownerRows.filter((r) => r.status === "expired").length;
    const nonTraite = pending + expired;

    const canalLinkedin = ownerRows.filter((r) => r.canal_used === "linkedin").length;
    const canalEmail = ownerRows.filter((r) => r.canal_used === "email").length;

    const ratings = ownerRows.filter((r) => r.rating !== null).map((r) => r.rating!);
    const ratingAvg = ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

    const slackInfo = ownerKey !== "__null__" ? slackMapping.get(ownerKey) : undefined;

    stats.push({
      ownerName: ownerKey,
      slackId: slackInfo?.slackId ?? null,
      displayName: slackInfo?.displayName ?? (ownerKey === "__null__" ? "Sans owner" : ownerKey.replace("_", " ")),
      total,
      sent,
      cancelled,
      pending,
      expired,
      nonTraite,
      pctSent: total > 0 ? Math.round((sent / total) * 100) : 0,
      pctCancelled: total > 0 ? Math.round((cancelled / total) * 100) : 0,
      pctNonTraite: total > 0 ? Math.round((nonTraite / total) * 100) : 0,
      canalLinkedin,
      canalEmail,
      ratingAvg,
      ratingCount: ratings.length,
    });
  }

  // Sort by total desc
  stats.sort((a, b) => b.total - a.total);
  return stats;
}

function computeTopCancelledReasons(rows: FinalDecisionRow[]): { reason: string; count: number }[] {
  const reasonCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.status === "cancelled" && row.cancelled_reason) {
      const normalized = row.cancelled_reason.trim();
      if (normalized.length === 0) continue;
      reasonCounts.set(normalized, (reasonCounts.get(normalized) ?? 0) + 1);
    }
  }

  return Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

// ============================================
// SLACK MESSAGE
// ============================================

function trend(currentPct: number, prevPct: number): string {
  if (currentPct > prevPct) return "↑";
  if (currentPct < prevPct) return "↓";
  return "→";
}

function buildSlackMessage(
  weekLabel: string,
  currentStats: OwnerStats[],
  prevStats: OwnerStats[],
  cancelledReasons: { reason: string; count: number }[],
): string {
  const prevByOwner = new Map(prevStats.map((s) => [s.ownerName, s]));

  let msg = `[Agent IA Recap] 📊 ${weekLabel}\n`;

  // Per-owner section
  for (const curr of currentStats) {
    const prev = prevByOwner.get(curr.ownerName);
    const mention = curr.slackId ? `<@${curr.slackId}> ` : "";

    msg += `\n👤 ${mention}*${curr.displayName}*\n`;
    msg += `• ${curr.total} recos reçues`;
    if (prev) {
      msg += ` (vs ${prev.total} sem. préc.)`;
    } else if (prevStats.length > 0) {
      msg += ` (nouveau)`;
    }
    msg += `\n`;

    // Sent
    const canalDetail = [];
    if (curr.canalLinkedin > 0) canalDetail.push(`${curr.canalLinkedin} LinkedIn`);
    if (curr.canalEmail > 0) canalDetail.push(`${curr.canalEmail} email`);
    const canalStr = canalDetail.length > 0 ? ` — ${canalDetail.join(", ")}` : "";
    msg += `• ✅ ${curr.sent} envoyées (${curr.pctSent}%`;
    if (prev) msg += ` ${trend(curr.pctSent, prev.pctSent)}`;
    msg += `)${canalStr}`;
    if (prev) msg += ` — vs ${prev.sent} (${prev.pctSent}%)`;
    msg += `\n`;

    // Cancelled
    msg += `• ❌ ${curr.cancelled} annulées (${curr.pctCancelled}%)\n`;

    // Non traitées
    msg += `• ⏳ ${curr.nonTraite} non traitées (${curr.pctNonTraite}%`;
    if (prev) msg += ` ${trend(curr.pctNonTraite, prev.pctNonTraite)}`;
    msg += `)`;
    if (prev) msg += ` — vs ${prev.nonTraite} (${prev.pctNonTraite}%)`;
    msg += `\n`;

    // Rating
    if (curr.ratingCount > 0) {
      msg += `• ⭐ Rating moyen: ${curr.ratingAvg}/5 (${curr.ratingCount} notées)\n`;
    }
  }

  // Team totals
  const currTotal = aggregateStats(currentStats);
  const prevTotal = aggregateStats(prevStats);

  msg += `\n📊 *Total équipe*: ${currTotal.total} recos | ${currTotal.sent} envoyées (${currTotal.pctSent}%) | ${currTotal.cancelled} annulées | ${currTotal.nonTraite} non traitées`;
  if (prevTotal.total > 0) {
    msg += `\nSem. préc.: ${prevTotal.total} recos | ${prevTotal.sent} envoyées (${prevTotal.pctSent}%) | ${prevTotal.cancelled} annulées | ${prevTotal.nonTraite} non traitées`;
  }

  // Top cancelled reasons
  if (cancelledReasons.length > 0) {
    msg += `\n\n🔴 *Top raisons d'annulation*`;
    for (let i = 0; i < cancelledReasons.length; i++) {
      const r = cancelledReasons[i];
      const reasonText = r.reason.length > 100 ? r.reason.substring(0, 100) + "…" : r.reason;
      msg += `\n${i + 1}. "${reasonText}" (${r.count}x)`;
    }
  }

  return msg;
}

function aggregateStats(stats: OwnerStats[]): {
  total: number; sent: number; cancelled: number; nonTraite: number; pctSent: number;
} {
  const total = stats.reduce((s, o) => s + o.total, 0);
  const sent = stats.reduce((s, o) => s + o.sent, 0);
  const cancelled = stats.reduce((s, o) => s + o.cancelled, 0);
  const nonTraite = stats.reduce((s, o) => s + o.nonTraite, 0);
  return {
    total,
    sent,
    cancelled,
    nonTraite,
    pctSent: total > 0 ? Math.round((sent / total) * 100) : 0,
  };
}

// ============================================
// WEBHOOK
// ============================================

async function postToWebhook(text: string): Promise<void> {
  const webhookUrl = process.env.webhook_team_sales;
  if (!webhookUrl) {
    logger.warn("webhook_team_sales not configured, falling back to script_logs");
    const fallback = process.env.script_logs;
    if (!fallback) {
      logger.error("No webhook configured (webhook_team_sales nor script_logs)");
      return;
    }
    await fetch(fallback, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return;
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
