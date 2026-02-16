import { logger, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "./lib/supabase.js";
import { unipile } from "./lib/unipile.js";
import { sleep } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const RATE_LIMIT = {
  PAUSE_BETWEEN_PROFILES: 600,
  PAUSE_BETWEEN_PAGES: 2000,
  PAUSE_BETWEEN_CONFIGS: 3000,
};

const LAST_VIEWED_HOURS = 72;

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_CONCURRENT ?? "";

const ENRICH_URL =
  "https://ybgckyywiobxfsyvddtx.supabase.co/functions/v1/enrich";
const ENRICH_TOKEN =
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InliZ2NreXl3aW9ieGZzeXZkZHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI1MjEwOTcsImV4cCI6MjA0ODA5NzA5N30.2VlgA93X5Qesfkq9C9S4GKe_2OUeCjCgc_W3Vd0ufPo";

const SALES_NAV_CONFIGS = [
  {
    key: "sales-nav-1",
    ghostGeniusAccountId: "77afde07-9ff8-4a78-a067-e8357a99a843",
    savedSearchUrl:
      "https://www.linkedin.com/sales/search/people?savedSearchId=1944182706",
    description: "Adrien Cousa - Abraxio",
    lgmAudience: "bertran_ruiz_concurrent_adrien_cousa_abraxio",
  },
  {
    key: "sales-nav-2",
    ghostGeniusAccountId: "bf6f248a-cec8-463a-9578-c1a101130aaa",
    savedSearchUrl:
      "https://www.linkedin.com/sales/search/people?savedSearchId=1945775018",
    description: "Laurent Defer - Triskell",
    lgmAudience: "bertran_ruiz_concurrent_laurent_defer_triskell",
  },
];

// ============================================
// TYPES
// ============================================
interface SalesNavConfig {
  key: string;
  ghostGeniusAccountId: string;
  savedSearchUrl: string;
  description: string;
  lgmAudience: string;
}

interface UnipileProfile {
  public_identifier?: string;
  public_profile_url?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
}

interface ConfigStats {
  inserted: number;
  skipped: number;
  errors: {
    type: string;
    code: string | number;
    message: string;
    profile: string;
  }[];
}

// ============================================
// SCHEDULED TASK
// ============================================
export const getStrategicConnectionsTask = schedules.task({
  id: "get-strategic-connections",
  maxDuration: 600,
  run: async () => {
    logger.info("=== START get-strategic-connections ===");

    const resultsByConfig: Record<string, ConfigStats> = {};
    let totalInserted = 0;

    for (let i = 0; i < SALES_NAV_CONFIGS.length; i++) {
      const config = SALES_NAV_CONFIGS[i];
      logger.info(
        `Config ${i + 1}/${SALES_NAV_CONFIGS.length}: ${config.description}`
      );

      const stats: ConfigStats = { inserted: 0, skipped: 0, errors: [] };

      try {
        const result = await processConfig(config, stats);
        totalInserted += result.inserted;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Fatal error for ${config.key}: ${msg}`);
        stats.errors.push({
          type: "Fatal",
          code: "exception",
          message: msg,
          profile: "Extraction complète",
        });
      }

      resultsByConfig[config.key] = stats;

      if (i < SALES_NAV_CONFIGS.length - 1) {
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_CONFIGS);
      }
    }

    await sendSlackErrorReport(resultsByConfig);

    const summary = {
      success: totalInserted >= 0,
      totalConfigs: SALES_NAV_CONFIGS.length,
      totalInserted,
      resultsByConfig,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// PROCESS A SINGLE CONFIG
// ============================================
async function processConfig(
  config: SalesNavConfig,
  stats: ConfigStats
): Promise<{ inserted: number }> {
  // 1. Lookup unipile_account_id
  const accountId = await getUnipileAccountId(config.ghostGeniusAccountId);
  if (!accountId) {
    throw new Error(
      `No unipile_account_id found for ghost_genius_account_id=${config.ghostGeniusAccountId}`
    );
  }
  logger.info(`Account ID resolved: ${accountId}`);

  // 2. Fetch new profiles (lastViewedAt = now - 72h)
  const newProfiles = await fetchNewProfiles(accountId, config.savedSearchUrl);
  logger.info(`${newProfiles.length} new profiles found`);

  if (newProfiles.length === 0) {
    logger.info(`No new profiles for ${config.description}`);
    return { inserted: 0 };
  }

  // 3. Enrich + upsert each new profile
  const scrapingDate = new Date().toISOString().split("T")[0];

  for (let j = 0; j < newProfiles.length; j++) {
    const profile = newProfiles[j];
    const identifier =
      profile.public_identifier ??
      profile.public_profile_url?.split("/in/")[1];

    if (!identifier) {
      logger.warn(`No identifier for profile index ${j}, skipping`);
      stats.errors.push({
        type: "Extraction ID",
        code: "missing",
        message: "No public_identifier or extractable slug",
        profile:
          `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() ||
          `index-${j}`,
      });
      continue;
    }

    try {
      const enrichData = await callEnrichFunction(identifier);

      if (!enrichData?.data) {
        logger.warn(`No enrich data for ${identifier}`);
        stats.errors.push({
          type: "Enrichissement",
          code: "empty",
          message: "No data returned from enrich",
          profile: identifier,
        });
        continue;
      }

      if (!enrichData.data.linkedin_private_id) {
        logger.warn(
          `No linkedin_private_id for ${enrichData.data.full_name ?? identifier}, skipping`
        );
        stats.errors.push({
          type: "Enrichissement",
          code: "missing_id",
          message: "linkedin_private_id manquant",
          profile: enrichData.data.full_name ?? identifier,
        });
        continue;
      }

      // connected_with: array → JSON string or null
      let connectedWithValue: string | null = null;
      if (
        Array.isArray(enrichData.data.connected_with) &&
        enrichData.data.connected_with.length > 0
      ) {
        connectedWithValue = JSON.stringify(enrichData.data.connected_with);
      }

      const row = {
        scraping_date: scrapingDate,
        sales_nav_source: config.key,
        sales_nav_description: config.description,
        linkedin_private_url: enrichData.data.linkedin_private_url,
        first_name: enrichData.data.first_name,
        last_name: enrichData.data.last_name,
        full_name: enrichData.data.full_name,
        linkedin_headline: enrichData.data.linkedin_headline,
        linkedin_job_title: enrichData.data.linkedin_job_title,
        company_linkedin_private_url:
          enrichData.data.company_linkedin_private_url,
        company_name: enrichData.data.company_name,
        location: enrichData.data.location,
        linkedin_profile_picture_url:
          enrichData.data.linkedin_profile_picture_url,
        linkedin_profile_url:
          enrichData.data.linkedin_profile_url ??
          `https://www.linkedin.com/in/${identifier}`,
        country: enrichData.data.country,
        linkedin_private_id: enrichData.data.linkedin_private_id,
        connected_with: connectedWithValue,
        job_strategic_role: enrichData.data.job_strategic_role,
      };

      const { error } = await supabase
        .from("scrapped_strategic_connection_concurrent")
        .upsert(row, {
          onConflict: "linkedin_private_id,sales_nav_description",
        });

      if (error) {
        logger.error(`Upsert error: ${error.message}`);
        stats.errors.push({
          type: "Supabase Upsert",
          code: error.code ?? "unknown",
          message: error.message,
          profile: enrichData.data.full_name ?? identifier,
        });
      } else {
        stats.inserted++;
        logger.debug(
          `Upserted: ${enrichData.data.full_name} [${j + 1}/${newProfiles.length}]`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Error processing ${identifier}: ${msg}`);
      stats.errors.push({
        type: "Enrichissement",
        code: "exception",
        message: msg,
        profile: identifier,
      });
    }

    if (j < newProfiles.length - 1) {
      await sleep(RATE_LIMIT.PAUSE_BETWEEN_PROFILES);
    }
  }

  logger.info(
    `Config ${config.key} done: ${stats.inserted} inserted, ${stats.skipped} skipped, ${stats.errors.length} errors`
  );
  return { inserted: stats.inserted };
}

// ============================================
// LOOKUP UNIPILE ACCOUNT ID
// ============================================
async function getUnipileAccountId(
  ghostGeniusAccountId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("workspace_team")
    .select("unipile_account_id")
    .eq("ghost_genius_account_id", ghostGeniusAccountId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase workspace_team lookup error: ${error.message}`);
  }

  return data?.unipile_account_id ?? null;
}

// ============================================
// FETCH NEW PROFILES (WITH lastViewedAt FILTER)
// ============================================
async function fetchNewProfiles(
  accountId: string,
  savedSearchUrl: string
): Promise<UnipileProfile[]> {
  const lastViewedAt = Date.now() - LAST_VIEWED_HOURS * 3600 * 1000;
  const urlWithFilter = `${savedSearchUrl}&lastViewedAt=${lastViewedAt}`;

  const allProfiles: UnipileProfile[] = [];
  let cursor: string | undefined;
  let page = 1;

  while (true) {
    logger.info(`Fetching new profiles page ${page}...`);

    const body: Record<string, unknown> = { url: urlWithFilter };
    if (cursor) {
      body.cursor = cursor;
    }

    const response = (await unipile.search(accountId, body)) as any;
    const items: UnipileProfile[] = response?.items ?? [];

    if (items.length === 0) {
      logger.info(`Empty page at ${page}, done`);
      break;
    }

    allProfiles.push(...items);
    logger.info(
      `Page ${page}: ${items.length} profiles (total: ${allProfiles.length})`
    );

    cursor = response?.cursor;
    if (!cursor) {
      logger.info("No more cursor, pagination complete");
      break;
    }

    page++;
    await sleep(RATE_LIMIT.PAUSE_BETWEEN_PAGES);
  }

  return allProfiles;
}

// ============================================
// ENRICH VIA SUPABASE EDGE FUNCTION
// ============================================
async function callEnrichFunction(publicIdentifier: string): Promise<any> {
  const res = await fetch(ENRICH_URL, {
    method: "POST",
    headers: {
      Authorization: ENRICH_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      parameter: "all",
      contact_linkedin_url: `http://linkedin.com/in/${publicIdentifier}`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Enrich failed: ${res.status} — ${text.substring(0, 200)}`
    );
  }

  return res.json();
}

// ============================================
// SLACK ERROR NOTIFICATION
// ============================================
async function sendSlackErrorReport(
  resultsByConfig: Record<string, ConfigStats>
): Promise<void> {
  let totalErrors = 0;
  for (const stats of Object.values(resultsByConfig)) {
    totalErrors += stats.errors.length;
  }

  if (totalErrors === 0) {
    logger.info("No errors, skipping Slack notification");
    return;
  }

  const now = new Date();
  const dateStr = now.toISOString().substring(0, 10);
  const timeStr = now.toISOString().substring(11, 16);

  let message = `[Scrapp LinkedIn Concurrent] ⚠️ Erreurs — ${dateStr} ${timeStr}\n\n`;

  message += "📊 Résultats\n";
  for (const [key, stats] of Object.entries(resultsByConfig)) {
    const config = SALES_NAV_CONFIGS.find((c) => c.key === key);
    const shortName = config
      ? config.description.split(" - ")[1] ?? config.description
      : key;
    message += `• ${shortName}: ${stats.inserted} insérés | ${stats.skipped} ignorés\n`;
  }

  message += `\n❌ Erreurs (${totalErrors})\n`;
  for (const [key, stats] of Object.entries(resultsByConfig)) {
    if (stats.errors.length === 0) continue;
    const config = SALES_NAV_CONFIGS.find((c) => c.key === key);
    const shortName = config
      ? config.description.split(" - ")[1] ?? config.description
      : key;

    const grouped: Record<string, number> = {};
    for (const err of stats.errors) {
      const errKey = `${err.type} (${err.code}) — "${err.message.substring(0, 100)}"`;
      grouped[errKey] = (grouped[errKey] ?? 0) + 1;
    }

    const parts = Object.entries(grouped).map(
      ([errType, count]) => `${count}x ${errType}`
    );
    message += `• ${shortName}: ${parts.join(", ")}\n`;
  }

  try {
    await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    logger.info("Slack notification sent");
  } catch (err) {
    logger.error("Failed to send Slack notification", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
