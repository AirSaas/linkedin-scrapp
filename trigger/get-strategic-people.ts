import { logger, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "./lib/supabase.js";
import { unipile } from "./lib/unipile.js";
import { sleep, sendErrorToScriptLogs, type TaskResultGroup } from "./lib/utils.js";

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

// Single account: bertranruiz
const GHOST_GENIUS_ACCOUNT_ID = "77afde07-9ff8-4a78-a067-e8357a99a843";

const SAVED_SEARCHES = [
  {
    key: "cio-dsi-france",
    savedSearchId: "50511602",
    savedSearchUrl:
      "https://www.linkedin.com/sales/search/people?savedSearchId=50511602",
    name: "CIO - DSI France",
  },
  {
    key: "pmo-france-new-job",
    savedSearchId: "1963982082",
    savedSearchUrl:
      "https://www.linkedin.com/sales/search/people?savedSearchId=1963982082",
    name: "PMO France new job",
  },
  {
    key: "head-transformation",
    savedSearchId: "1963982090",
    savedSearchUrl:
      "https://www.linkedin.com/sales/search/people?savedSearchId=1963982090",
    name: "Head of transformation",
  },
];

// ============================================
// TYPES
// ============================================
interface SavedSearch {
  key: string;
  savedSearchId: string;
  savedSearchUrl: string;
  name: string;
}

interface UnipileProfile {
  public_identifier?: string;
  public_profile_url?: string;
  first_name?: string;
  last_name?: string;
}

interface SearchStats {
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
export const getStrategicPeopleTask = schedules.task({
  id: "get-strategic-people",
  maxDuration: 600,
  run: async () => {
    logger.info("=== START get-strategic-people ===");

    // 1. Resolve unipile account
    const accountId = await getUnipileAccountId(GHOST_GENIUS_ACCOUNT_ID);
    if (!accountId) {
      throw new Error(
        `No unipile_account_id for ghost_genius_account_id=${GHOST_GENIUS_ACCOUNT_ID}`
      );
    }
    logger.info(`Account ID resolved: ${accountId}`);

    const resultsBySearch: Record<string, SearchStats> = {};
    let totalInserted = 0;

    // 2. Process each saved search
    for (let i = 0; i < SAVED_SEARCHES.length; i++) {
      const search = SAVED_SEARCHES[i];
      logger.info(
        `Search ${i + 1}/${SAVED_SEARCHES.length}: ${search.name}`
      );

      const stats: SearchStats = { inserted: 0, skipped: 0, errors: [] };

      try {
        const result = await processSearch(accountId, search, stats);
        totalInserted += result.inserted;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Fatal error for ${search.key}: ${msg}`);
        stats.errors.push({
          type: "Fatal",
          code: "exception",
          message: msg,
          profile: "Extraction complète",
        });
      }

      resultsBySearch[search.key] = stats;

      if (i < SAVED_SEARCHES.length - 1) {
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_CONFIGS);
      }
    }

    await sendSlackErrorReport(resultsBySearch);

    // Send error recap to #script-logs
    const scriptLogGroups: TaskResultGroup[] = Object.entries(resultsBySearch).map(
      ([key, stats]) => ({
        label: SAVED_SEARCHES.find((s) => s.key === key)?.name ?? key,
        inserted: stats.inserted,
        skipped: stats.skipped,
        errors: stats.errors,
      })
    );
    await sendErrorToScriptLogs("Strategic People SalesNav", scriptLogGroups);

    const summary = {
      success: totalInserted >= 0,
      totalSearches: SAVED_SEARCHES.length,
      totalInserted,
      resultsBySearch,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// PROCESS A SINGLE SAVED SEARCH
// ============================================
async function processSearch(
  accountId: string,
  search: SavedSearch,
  stats: SearchStats
): Promise<{ inserted: number }> {
  // Fetch new profiles with lastViewedAt
  const newProfiles = await fetchNewProfiles(accountId, search.savedSearchUrl);
  logger.info(`${newProfiles.length} new profiles found for ${search.name}`);

  if (newProfiles.length === 0) {
    return { inserted: 0 };
  }

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

      const linkedinPrivateUrl =
        enrichData.data.linkedin_private_url ?? identifier;
      const linkedinProfileUrl =
        enrichData.data.linkedin_profile_url ??
        `https://www.linkedin.com/in/${identifier}`;

      const row = {
        linkedin_private_url: linkedinPrivateUrl,
        linkedin_profile_url: linkedinProfileUrl,
        scraping_date: scrapingDate,
        saved_search_id: search.savedSearchId,
        saved_search_name: search.name,
      };

      const { error } = await supabase
        .from("new_scrapp_strategic_people_salesnav")
        .upsert(row, {
          onConflict: "linkedin_private_url,saved_search_name",
        });

      if (error) {
        logger.error(`Upsert error: ${error.message}`);
        stats.errors.push({
          type: "Supabase Upsert",
          code: error.code ?? "unknown",
          message: error.message,
          profile: linkedinPrivateUrl,
        });
      } else {
        stats.inserted++;
        logger.debug(
          `Upserted: ${linkedinPrivateUrl} [${j + 1}/${newProfiles.length}]`
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
    `Search ${search.key} done: ${stats.inserted} inserted, ${stats.errors.length} errors`
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
  resultsBySearch: Record<string, SearchStats>
): Promise<void> {
  let totalErrors = 0;
  for (const stats of Object.values(resultsBySearch)) {
    totalErrors += stats.errors.length;
  }

  if (totalErrors === 0) {
    logger.info("No errors, skipping Slack notification");
    return;
  }

  if (!SLACK_WEBHOOK_URL) {
    logger.warn("SLACK_WEBHOOK_CONCURRENT not set, skipping notification");
    return;
  }

  const now = new Date();
  const dateStr = now.toISOString().substring(0, 10);
  const timeStr = now.toISOString().substring(11, 16);

  let message = `[Strategic People SalesNav — Trigger.dev] ⚠️ Erreurs — ${dateStr} ${timeStr}\n\n`;

  message += "📊 Résultats\n";
  for (const [key, stats] of Object.entries(resultsBySearch)) {
    const search = SAVED_SEARCHES.find((s) => s.key === key);
    const name = search?.name ?? key;
    message += `• ${name}: ${stats.inserted} insérés | ${stats.skipped} ignorés\n`;
  }

  message += `\n❌ Erreurs (${totalErrors})\n`;
  for (const [key, stats] of Object.entries(resultsBySearch)) {
    if (stats.errors.length === 0) continue;
    const search = SAVED_SEARCHES.find((s) => s.key === key);
    const name = search?.name ?? key;

    const grouped: Record<string, number> = {};
    for (const err of stats.errors) {
      const errKey = `${err.type} (${err.code}) — "${err.message.substring(0, 100)}"`;
      grouped[errKey] = (grouped[errKey] ?? 0) + 1;
    }

    const parts = Object.entries(grouped).map(
      ([errType, count]) => `${count}x ${errType}`
    );
    message += `• ${name}: ${parts.join(", ")}\n`;
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
