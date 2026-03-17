/**
 * Supabase helpers for Circle posts sync
 * Projet: tchat-support-sync (oqiowupiczgrezgyopfm)
 *
 * Env vars (same as crisp-supabase.ts):
 * - TCHAT_SUPPORT_SYNC_SUPABASE_URL
 * - TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@trigger.dev/sdk/v3";

// ============================================
// Lazy init
// ============================================

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.TCHAT_SUPPORT_SYNC_SUPABASE_URL!,
      process.env.TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY!
    );
  }
  return _supabase;
}

// ============================================
// Sync cursor
// ============================================

export async function getSyncCursor(spaceSlug: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("circle_sync_cursor")
    .select("last_synced_at")
    .eq("space_slug", spaceSlug)
    .single();

  return data?.last_synced_at ?? null;
}

export async function updateSyncCursor(
  spaceSlug: string,
  lastSyncedAt: string
): Promise<void> {
  await getSupabase()
    .from("circle_sync_cursor")
    .upsert(
      {
        space_slug: spaceSlug,
        last_synced_at: lastSyncedAt,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "space_slug" }
    );
}

// ============================================
// Posts upsert
// ============================================

export async function upsertPosts(
  rows: Record<string, unknown>[]
): Promise<{ upserted: number; errors: string[] }> {
  if (!rows.length) return { upserted: 0, errors: [] };

  const errors: string[] = [];
  let upserted = 0;

  // Batch by 20 to avoid payload limits
  for (let i = 0; i < rows.length; i += 20) {
    const chunk = rows.slice(i, i + 20);
    const { error } = await getSupabase()
      .from("circle_posts")
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: false });

    if (error) {
      const msg = `Upsert chunk ${i}-${i + chunk.length}: ${error.message}`;
      logger.error(msg);
      errors.push(msg);
    } else {
      upserted += chunk.length;
    }
  }

  return { upserted, errors };
}

// ============================================
// Circle context for FAQ cross-reference
// ============================================

const TEAM_NAMES = ["simon", "thomas", "matthieu", "bertran"];

interface CirclePostRow {
  id: number;
  name: string;
  url: string;
  space_slug: string;
  body_plain_text: string | null;
  comments: unknown[] | null;
  published_at: string;
}

/**
 * Build a compact text block of all Circle posts for injection into the FAQ prompt.
 * Includes post title, URL, space, excerpt, and team member comments.
 */
export async function getCircleContext(): Promise<string> {
  const { data, error } = await getSupabase()
    .from("circle_posts")
    .select("id, name, url, space_slug, body_plain_text, comments, published_at")
    .order("published_at", { ascending: false });

  if (error || !data?.length) {
    logger.warn("getCircleContext: no data", { error });
    return "";
  }

  const lines: string[] = [
    "ARTICLES COMMUNAUTÉ CIRCLE (base de connaissances produit) :",
    "",
  ];

  for (const post of data as CirclePostRow[]) {
    const excerpt = (post.body_plain_text || "").slice(0, 200).replace(/\n/g, " ");
    const date = post.published_at?.slice(0, 10) || "";
    lines.push(`- [${post.space_slug}] "${post.name}" (${date})`);
    lines.push(`  URL: ${post.url}`);
    if (excerpt) lines.push(`  Résumé: ${excerpt}`);

    // Extract team member comments (solutions, clarifications)
    if (Array.isArray(post.comments) && post.comments.length > 0) {
      const teamComments = extractTeamComments(post.comments);
      if (teamComments.length > 0) {
        lines.push(`  Réponses équipe: ${teamComments.join(" | ")}`);
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function extractTeamComments(comments: unknown[]): string[] {
  const results: string[] = [];

  for (const c of comments as Record<string, unknown>[]) {
    const user = c.user as Record<string, string> | undefined;
    const body = c.body as Record<string, string> | undefined;
    if (!user?.name || !body?.body) continue;

    const nameLower = user.name.toLowerCase();
    if (TEAM_NAMES.some((t) => nameLower.includes(t))) {
      const text = body.body
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .slice(0, 150)
        .replace(/\n/g, " ")
        .trim();
      if (text) {
        results.push(`${user.name}: "${text}"`);
      }
    }

    // Check nested replies
    if (Array.isArray(c.replies) && (c.replies as unknown[]).length > 0) {
      results.push(...extractTeamComments(c.replies as unknown[]));
    }
  }

  return results.slice(0, 5); // Cap per post to keep context manageable
}
