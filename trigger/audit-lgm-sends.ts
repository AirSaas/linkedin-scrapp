import { logger, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "./lib/supabase.js";
import { sleep } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const LGM_API_BASE = "https://apiv2.lagrowthmachine.com/flow";
const LOOKBACK_DAYS = 7;

// Known LGM audience names (destinations that are actual audiences, not HUBSPOT_*/SKIPPED/EXCLUDED/UNMAPPED)
const HUBSPOT_DESTINATIONS = new Set([
  "HUBSPOT_ACTIVATE",
  "HUBSPOT_ASSIGN",
  "HUBSPOT_CREATE",
  "SKIPPED",
  "EXCLUDED",
  "UNMAPPED",
]);

// ============================================
// SCHEDULED TASK
// ============================================
export const auditLgmSendsTask = schedules.task({
  id: "audit-lgm-sends",
  maxDuration: 300,
  run: async () => {
    logger.info("=== START audit-lgm-sends ===");

    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const sinceIso = since.toISOString();

    // 1. Query lgm_send_log grouped by destination
    const { data: logs, error: logsError } = await supabase
      .from("lgm_send_log")
      .select("destination, lgm_response_msg, lgm_http_status")
      .gte("created_at", sinceIso);

    if (logsError) {
      logger.error(`Failed to query lgm_send_log: ${logsError.message}`);
      await postToSlack(`[Audit LGM Sends] Error querying lgm_send_log: ${logsError.message}`);
      return;
    }

    if (!logs || logs.length === 0) {
      logger.info("No logs found in the last 7 days");
      await postToSlack(`[Audit LGM Sends] No sends logged in the last ${LOOKBACK_DAYS} days.`);
      return;
    }

    // 2. Group and count by destination
    const stats = new Map<
      string,
      { total: number; created: number; duplicate: number; failed: number }
    >();

    for (const log of logs) {
      const dest = log.destination;
      if (!stats.has(dest)) {
        stats.set(dest, { total: 0, created: 0, duplicate: 0, failed: 0 });
      }
      const s = stats.get(dest)!;
      s.total++;

      if (HUBSPOT_DESTINATIONS.has(dest)) continue;

      const msg = (log.lgm_response_msg ?? "").toLowerCase();
      const status = log.lgm_http_status;
      if (status && status >= 400) {
        s.failed++;
      } else if (msg.includes("duplicate") || msg.includes("merged")) {
        s.duplicate++;
      } else if (msg.includes("created") || msg.includes("added")) {
        s.created++;
      }
    }

    // 3. Fetch current LGM audience sizes
    const audienceSizes = await fetchLgmAudienceSizes();

    // 4. Build report
    const now = new Date().toISOString().substring(0, 10);
    let message = `[Audit LGM Sends] ${now} (${LOOKBACK_DAYS}j)\n\n`;

    // LGM audiences first
    const lgmAudiences = [...stats.entries()]
      .filter(([dest]) => !HUBSPOT_DESTINATIONS.has(dest))
      .sort(([a], [b]) => a.localeCompare(b));

    if (lgmAudiences.length > 0) {
      message += `${"Audience".padEnd(50)} Sent  New  Dup  Err  LGM Size\n`;
      message += `${"─".repeat(50)} ${"────"}  ${"───"}  ${"───"}  ${"───"}  ${"────────"}\n`;

      let totalSent = 0, totalNew = 0, totalDup = 0, totalErr = 0;

      for (const [dest, s] of lgmAudiences) {
        const size = audienceSizes.get(dest) ?? "?";
        message += `${dest.padEnd(50)} ${String(s.total).padStart(4)}  ${String(s.created).padStart(3)}  ${String(s.duplicate).padStart(3)}  ${String(s.failed).padStart(3)}  ${String(size).padStart(8)}\n`;
        totalSent += s.total;
        totalNew += s.created;
        totalDup += s.duplicate;
        totalErr += s.failed;
      }

      message += `\nTotal LGM: ${totalSent} envoyés, ${totalNew} nouveaux, ${totalDup} dupliqués, ${totalErr} erreurs\n`;
    }

    // HubSpot/Skip/Excluded summary
    const otherDests = [...stats.entries()]
      .filter(([dest]) => HUBSPOT_DESTINATIONS.has(dest))
      .sort(([a], [b]) => a.localeCompare(b));

    if (otherDests.length > 0) {
      message += `\nAutres routages:\n`;
      for (const [dest, s] of otherDests) {
        message += `  ${dest}: ${s.total}\n`;
      }
    }

    logger.info(message);
    await postToSlack(message);

    return { audienceCount: lgmAudiences.length, totalLogs: logs.length };
  },
});

// ============================================
// HELPERS
// ============================================
async function fetchLgmAudienceSizes(): Promise<Map<string, number>> {
  const apiKey = process.env.LGM_API_KEY ?? "";
  const sizes = new Map<string, number>();

  try {
    const res = await fetch(`${LGM_API_BASE}/audiences?apikey=${apiKey}`);
    if (!res.ok) {
      logger.warn(`LGM audiences API error: ${res.status}`);
      return sizes;
    }

    const data = (await res.json()) as Array<{ name?: string; leadCount?: number }>;
    for (const audience of data) {
      if (audience.name) {
        sizes.set(audience.name, audience.leadCount ?? 0);
      }
    }
    await sleep(200);
  } catch (err) {
    logger.warn(`LGM audiences fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return sizes;
}

async function postToSlack(text: string): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) {
    logger.warn("script_logs webhook not configured");
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    logger.error(`Slack post failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
