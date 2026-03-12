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
