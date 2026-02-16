import { logger, schedules } from "@trigger.dev/sdk/v3";
import { supabase } from "./lib/supabase.js";
import { unipile } from "./lib/unipile.js";
import { sleep } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const RATE_LIMIT = {
  PAUSE_BETWEEN_RELATIONS: 200,
  PAUSE_BETWEEN_PAGES: 2000,
  PAUSE_BETWEEN_MEMBERS: 3000,
};

const PAGE_SIZE = 10;
const MAX_PAGES_PER_MEMBER = 10;

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_CONCURRENT ?? "";

// ============================================
// TYPES
// ============================================
interface TeamMember {
  id: string;
  linkedin_url_owner_post: string;
  unipile_account_id: string;
}

interface UnipileRelation {
  public_profile_url?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  member_id?: string;
  created_at?: number;
}

interface MemberStats {
  inserted: number;
  duplicates: number;
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
export const getTeamConnectionsTask = schedules.task({
  id: "get-team-connections",
  maxDuration: 600,
  run: async () => {
    logger.info("=== START get-team-connections ===");

    // 1. Get team members with unipile_account_id
    const members = await getTeamMembers();
    logger.info(`${members.length} team members found`);

    if (members.length === 0) {
      logger.info("No team members with unipile_account_id, exiting");
      return { success: true, totalMembers: 0, totalInserted: 0 };
    }

    const resultsByMember: Record<string, MemberStats> = {};
    let totalInserted = 0;

    // 2. Process each team member
    for (let i = 0; i < members.length; i++) {
      const member = members[i];
      logger.info(
        `Member ${i + 1}/${members.length}: ${member.linkedin_url_owner_post}`
      );

      const stats: MemberStats = { inserted: 0, duplicates: 0, errors: [] };

      try {
        const result = await processMember(member, stats);
        totalInserted += result.inserted;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Fatal error for ${member.linkedin_url_owner_post}: ${msg}`);
        stats.errors.push({
          type: "Fatal",
          code: "exception",
          message: msg,
          profile: member.linkedin_url_owner_post,
        });
      }

      resultsByMember[member.linkedin_url_owner_post] = stats;

      if (i < members.length - 1) {
        await sleep(RATE_LIMIT.PAUSE_BETWEEN_MEMBERS);
      }
    }

    await sendSlackErrorReport(resultsByMember);

    const summary = {
      success: totalInserted >= 0,
      totalMembers: members.length,
      totalInserted,
      resultsByMember,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});

// ============================================
// GET TEAM MEMBERS
// ============================================
async function getTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("workspace_team")
    .select("id, linkedin_url_owner_post, unipile_account_id")
    .not("unipile_account_id", "is", null);

  if (error) {
    throw new Error(`Failed to fetch workspace_team: ${error.message}`);
  }

  return (data ?? []) as TeamMember[];
}

// ============================================
// PROCESS A SINGLE TEAM MEMBER
// ============================================
async function processMember(
  member: TeamMember,
  stats: MemberStats
): Promise<{ inserted: number }> {
  const scrapingDate = new Date().toISOString().split("T")[0];
  let cursor: string | undefined;
  let page = 1;

  while (page <= MAX_PAGES_PER_MEMBER) {
    logger.info(
      `Fetching relations page ${page} for ${member.linkedin_url_owner_post}...`
    );

    const response = (await unipile.getRelations(
      member.unipile_account_id,
      PAGE_SIZE,
      cursor
    )) as any;

    const items: UnipileRelation[] = response?.items ?? [];

    if (items.length === 0) {
      logger.info(`Empty page at ${page}, done`);
      break;
    }

    // Build rows from this page
    const rows: { url: string; row: Record<string, unknown> }[] = [];
    for (let j = 0; j < items.length; j++) {
      const relation = items[j];

      if (!relation.public_profile_url) {
        logger.warn(`No public_profile_url for relation index ${j}, skipping`);
        stats.errors.push({
          type: "Missing URL",
          code: "missing",
          message: "No public_profile_url",
          profile:
            `${relation.first_name ?? ""} ${relation.last_name ?? ""}`.trim() ||
            `index-${j}`,
        });
        continue;
      }

      // Strip trailing slash to match existing data format
      const profileUrl = relation.public_profile_url.replace(/\/$/, "");

      // Convert created_at (ms timestamp) to YYYY-MM-DD
      const connectedAt = relation.created_at
        ? new Date(relation.created_at).toISOString().split("T")[0]
        : null;

      rows.push({
        url: profileUrl,
        row: {
          type_reaction: "connection",
          profil_linkedin_url_connection: profileUrl,
          profil_fullname:
            `${relation.first_name ?? ""} ${relation.last_name ?? ""}`.trim() ||
            null,
          linkedin_url_owner_post: member.linkedin_url_owner_post,
          headline: relation.headline ?? null,
          created_at: scrapingDate,
          connected_at: connectedAt,
          contact_urn: relation.member_id ?? null,
        },
      });
    }

    if (rows.length === 0) {
      logger.info(`No valid relations on page ${page}, done`);
      break;
    }

    // Check which URLs already exist in DB for this owner
    const { data: existing } = await supabase
      .from("scrapped_connection")
      .select("profil_linkedin_url_connection")
      .eq("linkedin_url_owner_post", member.linkedin_url_owner_post)
      .in(
        "profil_linkedin_url_connection",
        rows.map((r) => r.url)
      );

    const existingUrls = new Set(
      (existing ?? []).map(
        (e: { profil_linkedin_url_connection: string }) =>
          e.profil_linkedin_url_connection
      )
    );

    const newRows = rows.filter((r) => !existingUrls.has(r.url));
    const pageNewCount = newRows.length;
    stats.duplicates += rows.length - newRows.length;

    // Upsert all rows (updates headline/connected_at for existing ones too)
    for (const { url, row } of rows) {
      const { error } = await supabase
        .from("scrapped_connection")
        .upsert(row, {
          onConflict: "profil_linkedin_url_connection,linkedin_url_owner_post",
        });

      if (error) {
        logger.error(`Upsert error: ${error.message}`);
        stats.errors.push({
          type: "Supabase Upsert",
          code: error.code ?? "unknown",
          message: error.message,
          profile: url,
        });
      }
    }

    stats.inserted += pageNewCount;

    logger.info(
      `Page ${page}: ${rows.length} relations, ${pageNewCount} new, ${rows.length - pageNewCount} duplicates`
    );

    // Smart stop: if all relations on this page were duplicates, stop
    if (pageNewCount === 0) {
      logger.info(
        `All ${rows.length} relations on page ${page} are duplicates, stopping`
      );
      break;
    }

    cursor = response?.cursor;
    if (!cursor) {
      logger.info("No more cursor, pagination complete");
      break;
    }

    page++;
    await sleep(RATE_LIMIT.PAUSE_BETWEEN_PAGES);
  }

  if (page > MAX_PAGES_PER_MEMBER) {
    logger.warn(
      `Reached max pages (${MAX_PAGES_PER_MEMBER}) for ${member.linkedin_url_owner_post}`
    );
  }

  logger.info(
    `Member ${member.linkedin_url_owner_post} done: ${stats.inserted} inserted, ${stats.duplicates} duplicates, ${stats.errors.length} errors`
  );
  return { inserted: stats.inserted };
}

// ============================================
// SLACK ERROR NOTIFICATION
// ============================================
async function sendSlackErrorReport(
  resultsByMember: Record<string, MemberStats>
): Promise<void> {
  let totalErrors = 0;
  for (const stats of Object.values(resultsByMember)) {
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

  let message = `[Team Connections] ⚠️ Erreurs — ${dateStr} ${timeStr}\n\n`;

  message += "📊 Résultats\n";
  for (const [ownerUrl, stats] of Object.entries(resultsByMember)) {
    const shortName = ownerUrl.split("/in/")[1] ?? ownerUrl;
    message += `• ${shortName}: ${stats.inserted} insérés | ${stats.duplicates} doublons\n`;
  }

  message += `\n❌ Erreurs (${totalErrors})\n`;
  for (const [ownerUrl, stats] of Object.entries(resultsByMember)) {
    if (stats.errors.length === 0) continue;
    const shortName = ownerUrl.split("/in/")[1] ?? ownerUrl;

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
