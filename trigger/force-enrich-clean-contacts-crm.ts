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
  maxDuration: 43200, // 12h — ~11k contacts at ~3.5s each (enrich ~2-3s + 600ms sleep)
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
    logger.info("Step 1: Fetching PRC_CONTACTS LinkedIn URLs...");
    const prcUrls: string[] = [];
    let offset = 0;
    let prcPages = 0;

    while (true) {
      const { data, error } = await supabase
        .from("PRC_CONTACTS")
        .select("CONTACT_LINKEDIN_PROFILE_URL")
        .not("CONTACT_LINKEDIN_PROFILE_URL", "is", null)
        .neq("CONTACT_LINKEDIN_PROFILE_URL", "")
        .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

      prcPages++;
      if (error) {
        logger.error("PRC_CONTACTS fetch error", { error: error.message, offset, page: prcPages });
        break;
      }
      if (!data || data.length === 0) {
        logger.info(`PRC_CONTACTS: page ${prcPages} empty, done fetching`);
        break;
      }

      logger.info(`PRC_CONTACTS: page ${prcPages} → ${data.length} rows (total so far: ${prcUrls.length + data.length})`);

      for (const row of data) {
        const url = row.CONTACT_LINKEDIN_PROFILE_URL as string;
        if (url) prcUrls.push(url);
      }

      if (data.length < SUPABASE_PAGE_SIZE) break;
      offset += SUPABASE_PAGE_SIZE;
    }

    logger.info(`Step 1 done: ${prcUrls.length} PRC_CONTACTS with LinkedIn URL (${prcPages} pages)`);

    // ------------------------------------------
    // 2. Fetch enriched_contacts cache (url → last_updated_at)
    // ------------------------------------------
    logger.info("Step 2: Fetching enriched_contacts cache...");
    const enrichedCache = new Map<string, string>();
    offset = 0;
    let cachePages = 0;

    while (true) {
      const { data, error } = await supabase
        .from("enriched_contacts")
        .select("linkedin_profile_url, last_updated_at")
        .range(offset, offset + SUPABASE_PAGE_SIZE - 1);

      cachePages++;
      if (error) {
        logger.error("enriched_contacts fetch error", { error: error.message, offset, page: cachePages });
        break;
      }
      if (!data || data.length === 0) {
        logger.info(`enriched_contacts: page ${cachePages} empty, done fetching`);
        break;
      }

      if (cachePages % 20 === 0) {
        logger.info(`enriched_contacts: page ${cachePages} → ${enrichedCache.size + data.length} entries so far`);
      }

      for (const row of data) {
        const url = row.linkedin_profile_url as string;
        const updatedAt = row.last_updated_at as string;
        if (url) enrichedCache.set(url, updatedAt);
      }

      if (data.length < SUPABASE_PAGE_SIZE) break;
      offset += SUPABASE_PAGE_SIZE;
    }

    logger.info(`Step 2 done: ${enrichedCache.size} enriched_contacts cached (${cachePages} pages)`);

    // ------------------------------------------
    // 3. Filter: keep contacts not in cache or stale
    // ------------------------------------------
    logger.info("Step 3: Filtering contacts...");
    const toEnrich: string[] = [];
    let skippedRecent = 0;
    let notInCache = 0;
    let staleInCache = 0;

    for (const url of prcUrls) {
      const cachedDate = enrichedCache.get(url);
      if (cachedDate && cachedDate > staleThreshold) {
        skippedRecent++;
        continue;
      }
      if (!cachedDate) notInCache++;
      else staleInCache++;
      toEnrich.push(url);
      if (toEnrich.length >= maxContacts) break;
    }

    logger.info(`Step 3 done — Filtering results`, {
      toEnrich: toEnrich.length,
      skippedRecent,
      notInCache,
      staleInCache,
      sample: toEnrich.slice(0, 5),
    });

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
    logger.info(`Step 4: Starting enrich loop — ${toEnrich.length} contacts, delay=${delayMs}ms`);
    let success = 0;
    let failed = 0;

    for (let i = 0; i < toEnrich.length; i++) {
      const url = toEnrich[i];

      // Log first 10, then every 100, then every 500
      const shouldLog = i < 10 || (i < 100 && i % 10 === 0) || i % 100 === 0;

      if (dryRun) {
        if (shouldLog) logger.info(`[DRY RUN] [${i + 1}/${toEnrich.length}] Would enrich: ${url}`);
        success++;
        continue;
      }

      try {
        const enrichResult = await callEnrichWithRetry(url);
        success++;

        if (shouldLog) {
          logger.info(`[${i + 1}/${toEnrich.length}] OK: ${url}`, {
            name: enrichResult?.data?.full_name ?? "?",
            company: enrichResult?.data?.company_name ?? "?",
            role: enrichResult?.data?.job_strategic_role ?? null,
            privateId: enrichResult?.data?.linkedin_private_id ? "yes" : "NO",
          });
        }
      } catch (err) {
        failed++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({
          type: "Enrichissement",
          code: "ENRICH_FAIL",
          message: `${url} — ${msg}`,
          profile: url,
        });
        // Log all errors for first 20, then cap
        if (failed <= 20) {
          logger.warn(`[${i + 1}/${toEnrich.length}] FAIL: ${url}`, { error: msg });
        }
        if (failed === 20) {
          logger.warn("Capping error logs at 20, further errors only tracked in summary");
        }
      }

      await sleep(delayMs);
    }

    const elapsedMin = Math.round((Date.now() - startTime) / 60_000);
    logger.info(`Step 4 done: ${success} success, ${failed} failed out of ${toEnrich.length} (${elapsedMin} min elapsed)`);

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
async function callEnrichWithRetry(linkedinUrl: string): Promise<any> {
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

    if (res.ok) {
      const json = await res.json();
      if (!json?.data?.linkedin_private_id) {
        logger.warn(`Enrich OK but missing linkedin_private_id for ${linkedinUrl}`, {
          keys: json?.data ? Object.keys(json.data).slice(0, 10) : "no data",
        });
      }
      return json;
    }

    const text = await res.text();
    if (attempt === 0) {
      logger.warn(`Enrich attempt 1 failed for ${linkedinUrl}`, {
        status: res.status,
        body: text.substring(0, 300),
      });
      await sleep(RETRY_DELAY_MS);
      continue;
    }

    throw new Error(`HTTP ${res.status} — ${text.substring(0, 300)}`);
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
