import { task, logger } from "@trigger.dev/sdk/v3";
import { supabase } from "./lib/supabase.js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const ENRICH_URL =
  "https://ybgckyywiobxfsyvddtx.supabase.co/functions/v1/enrich";
const ENRICH_TOKEN =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZ2NreXl3aW9ieGZzeXZkZHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI1MjEwOTcsImV4cCI6MjA0ODA5NzA5N30.2VlgA93X5Qesfkq9C9S4GKe_2OUeCjCgc_W3Vd0ufPo";

const DEFAULTS = {
  maxContacts: 40_000,
  delayMs: 600,
  staleDays: 60,
  dryRun: false,
};

const SUPABASE_PAGE_SIZE = 1000;
const RETRY_DELAY_MS = 2000;

interface Payload {
  maxContacts?: number;
  delayMs?: number;
  staleDays?: number;
  dryRun?: boolean;
}

// ============================================
// TASK
// ============================================
export const forceEnrichCleanContactsCrm = task({
  id: "force-enrich-clean-contacts-crm",
  run: async (payload: Payload) => {
    const maxContacts = payload.maxContacts ?? DEFAULTS.maxContacts;
    const delayMs = payload.delayMs ?? DEFAULTS.delayMs;
    const staleDays = payload.staleDays ?? DEFAULTS.staleDays;
    const dryRun = payload.dryRun ?? DEFAULTS.dryRun;

    const staleThreshold = new Date(
      Date.now() - staleDays * 24 * 60 * 60 * 1000
    ).toISOString();

    logger.info("Config", { maxContacts, delayMs, staleDays, dryRun, staleThreshold });

    const startTime = Date.now();
    const errors: TaskError[] = [];

    // ------------------------------------------
    // 1. Fetch all PRC_CONTACTS LinkedIn URLs
    // ------------------------------------------
    logger.info("Fetching PRC_CONTACTS LinkedIn URLs...");
    const prcUrls: string[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("PRC_CONTACTS")
        .select("CONTACT_LINKEDIN_PROFILE_URL")
        .not("CONTACT_LINKEDIN_PROFILE_URL", "is", null)
        .neq("CONTACT_LINKEDIN_PROFILE_URL", "")
        .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

      if (error) {
        logger.error("PRC_CONTACTS fetch error", { error: error.message, offset });
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        const url = row.CONTACT_LINKEDIN_PROFILE_URL as string;
        if (url) prcUrls.push(url);
      }

      if (data.length < SUPABASE_PAGE_SIZE) break;
      offset += SUPABASE_PAGE_SIZE;
    }

    logger.info(`PRC_CONTACTS with LinkedIn: ${prcUrls.length}`);

    // ------------------------------------------
    // 2. Fetch enriched_contacts cache (url → last_updated_at)
    // ------------------------------------------
    logger.info("Fetching enriched_contacts cache...");
    const enrichedCache = new Map<string, string>();
    offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("enriched_contacts")
        .select("linkedin_profile_url, last_updated_at")
        .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

      if (error) {
        logger.error("enriched_contacts fetch error", { error: error.message, offset });
        break;
      }
      if (!data || data.length === 0) break;

      for (const row of data) {
        const url = row.linkedin_profile_url as string;
        const updatedAt = row.last_updated_at as string;
        if (url) enrichedCache.set(url, updatedAt);
      }

      if (data.length < SUPABASE_PAGE_SIZE) break;
      offset += SUPABASE_PAGE_SIZE;
    }

    logger.info(`enriched_contacts cache loaded: ${enrichedCache.size} entries`);

    // ------------------------------------------
    // 3. Filter: keep contacts not in cache or stale
    // ------------------------------------------
    const toEnrich: string[] = [];
    let skippedRecent = 0;

    for (const url of prcUrls) {
      const cachedDate = enrichedCache.get(url);
      if (cachedDate && cachedDate > staleThreshold) {
        skippedRecent++;
        continue;
      }
      toEnrich.push(url);
      if (toEnrich.length >= maxContacts) break;
    }

    logger.info(
      `Filtered: ${toEnrich.length} to enrich, ${skippedRecent} skipped (recent)`
    );

    if (toEnrich.length === 0) {
      logger.info("Nothing to enrich, exiting");
      await sendSlackRecap({
        totalPrc: prcUrls.length,
        skippedRecent,
        toEnrich: 0,
        success: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
        dryRun,
      });
      return;
    }

    // ------------------------------------------
    // 4. Enrich loop
    // ------------------------------------------
    let success = 0;
    let failed = 0;

    for (let i = 0; i < toEnrich.length; i++) {
      const url = toEnrich[i];

      if (i > 0 && i % 500 === 0) {
        logger.info(`Progress: ${i}/${toEnrich.length} (${success} ok, ${failed} err)`);
      }

      if (dryRun) {
        logger.info(`[DRY RUN] Would enrich: ${url}`);
        success++;
        continue;
      }

      try {
        await callEnrichWithRetry(url);
        success++;
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({
          type: "Enrichissement",
          code: "ENRICH_FAIL",
          message: `${url} — ${msg}`,
          profile: url,
        });
        if (failed <= 5) {
          logger.warn(`Enrich failed: ${url}`, { error: msg });
        }
      }

      await sleep(delayMs);
    }

    logger.info(
      `Done: ${success} success, ${failed} failed out of ${toEnrich.length}`
    );

    // ------------------------------------------
    // 5. Reports
    // ------------------------------------------
    if (errors.length > 0) {
      await sendErrorToScriptLogs("Force Enrich Clean Contacts CRM", [
        {
          label: "PRC_CONTACTS",
          inserted: success,
          skipped: skippedRecent,
          errors,
        },
      ]);
    }

    await sendSlackRecap({
      totalPrc: prcUrls.length,
      skippedRecent,
      toEnrich: toEnrich.length,
      success,
      failed,
      durationMs: Date.now() - startTime,
      dryRun,
    });
  },
});

// ============================================
// ENRICH WITH 1 RETRY
// ============================================
async function callEnrichWithRetry(linkedinUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(ENRICH_URL, {
      method: "POST",
      headers: {
        Authorization: ENRICH_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parameter: "all",
        contact_linkedin_url: linkedinUrl,
        force_enrich: true,
      }),
    });

    if (res.ok) return;

    const text = await res.text();
    if (attempt === 0) {
      logger.warn(`Enrich attempt 1 failed (${res.status}), retrying in 2s...`);
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    throw new Error(`${res.status} — ${text.substring(0, 200)}`);
  }
}

// ============================================
// SLACK SUCCESS RECAP
// ============================================
interface RecapData {
  totalPrc: number;
  skippedRecent: number;
  toEnrich: number;
  success: number;
  failed: number;
  durationMs: number;
  dryRun: boolean;
}

async function sendSlackRecap(data: RecapData): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) return;

  const durationMin = Math.round(data.durationMs / 60_000);
  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  const prefix = data.dryRun ? "[Force Enrich — DRY RUN]" : "[Force Enrich Clean CRM]";
  const emoji = data.failed > 0 ? "⚠️" : "✅";

  const now = new Date().toISOString().substring(0, 16).replace("T", " ");

  const text = [
    `${prefix} ${emoji} Résultats — ${now}`,
    "",
    `📊 Résumé`,
    `• PRC_CONTACTS avec LinkedIn: ${data.totalPrc}`,
    `• Déjà enrichis récemment: ${data.skippedRecent} skipped`,
    `• À enrichir: ${data.toEnrich}`,
    `• Succès: ${data.success} | Erreurs: ${data.failed}`,
    `• Durée: ${durationStr}`,
  ].join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    logger.error("Slack recap failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
