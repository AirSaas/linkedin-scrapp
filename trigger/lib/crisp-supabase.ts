/**
 * Client Supabase pour le stockage des conversations/messages Crisp
 * Projet: tchat-support-sync (oqiowupiczgrezgyopfm)
 *
 * Env vars dédiées (différentes du Supabase principal) :
 * - TCHAT_SUPPORT_SYNC_SUPABASE_URL
 * - TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@trigger.dev/sdk/v3";
import type { CrispConversation, CrispMessage } from "./crisp.js";

// ============================================
// Lazy init
// ============================================

let _crispSupabase: SupabaseClient | null = null;

function getCrispSupabase(): SupabaseClient {
  if (!_crispSupabase) {
    _crispSupabase = createClient(
      process.env.TCHAT_SUPPORT_SYNC_SUPABASE_URL!,
      process.env.TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY!
    );
  }
  return _crispSupabase;
}

function getWebsiteId(): string {
  return process.env.CRISP_WEBSITE_ID!;
}

// ============================================
// Conversations
// ============================================

export async function upsertConversation(
  sessionId: string,
  meta: CrispConversation["meta"] | null,
  convo: Partial<CrispConversation>
): Promise<boolean> {
  const { error } = await getCrispSupabase()
    .from("tchat_conversations")
    .upsert(
      {
        session_id: sessionId,
        website_id: getWebsiteId(),
        contact_email: meta?.email || null,
        contact_name: meta?.nickname || null,
        state: convo.state || null,
        created_at: convo.created_at ? new Date(convo.created_at).toISOString() : null,
        updated_at: convo.updated_at ? new Date(convo.updated_at).toISOString() : null,
        synced_at: new Date().toISOString(),
        metadata: meta || {},
      },
      { onConflict: "session_id" }
    );

  if (error) {
    logger.error("upsertConversation error", { error, sessionId });
    return false;
  }
  return true;
}

// ============================================
// Messages
// ============================================

export async function messageExists(fingerprint: string): Promise<boolean> {
  const { data } = await getCrispSupabase()
    .from("tchat_messages")
    .select("id")
    .eq("fingerprint", fingerprint)
    .maybeSingle();
  return !!data;
}

export async function insertMessage(msg: CrispMessage, sessionId: string): Promise<boolean> {
  const fingerprint = String(msg.fingerprint);
  const direction = msg.from === "user" ? "INBOUND" : "OUTBOUND";
  const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

  const { error } = await getCrispSupabase()
    .from("tchat_messages")
    .insert({
      fingerprint,
      session_id: sessionId,
      website_id: getWebsiteId(),
      content,
      content_type: msg.type || "text",
      direction,
      sender_type: msg.from,
      sender_name: msg.user?.nickname || null,
      sender_email: null,
      crisp_timestamp: new Date(msg.timestamp).toISOString(),
      raw_data: msg,
    });

  if (error) {
    if (error.code === "23505") return false; // dupe, OK
    logger.error("insertMessage error", { error, fingerprint });
    return false;
  }
  return true;
}

/**
 * Insert un batch de messages en une fois (plus rapide)
 * Retourne le nombre de messages insérés
 */
export async function insertMessagesBatch(
  messages: CrispMessage[],
  sessionId: string
): Promise<number> {
  if (!messages.length) return 0;

  const rows = messages.map((msg) => ({
    fingerprint: String(msg.fingerprint),
    session_id: sessionId,
    website_id: getWebsiteId(),
    content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    content_type: msg.type || "text",
    direction: msg.from === "user" ? "INBOUND" : "OUTBOUND",
    sender_type: msg.from,
    sender_name: msg.user?.nickname || null,
    sender_email: null,
    crisp_timestamp: new Date(msg.timestamp).toISOString(),
    raw_data: msg,
  }));

  // Upsert pour ignorer les doublons
  const { data, error } = await getCrispSupabase()
    .from("tchat_messages")
    .upsert(rows, { onConflict: "fingerprint", ignoreDuplicates: true })
    .select("id");

  if (error) {
    logger.error("insertMessagesBatch error", { error, count: rows.length });
    return 0;
  }

  return data?.length || 0;
}

// ============================================
// Compteurs conversation
// ============================================

export async function updateConversationCounters(sessionId: string): Promise<void> {
  const { data: msgs } = await getCrispSupabase()
    .from("tchat_messages")
    .select("direction, crisp_timestamp")
    .eq("session_id", sessionId)
    .order("crisp_timestamp", { ascending: true });

  if (!msgs?.length) return;

  const inbound = msgs.filter((m) => m.direction === "INBOUND").length;
  const outbound = msgs.filter((m) => m.direction === "OUTBOUND").length;

  await getCrispSupabase()
    .from("tchat_conversations")
    .update({
      message_count_inbound: inbound,
      message_count_outbound: outbound,
      first_message_at: msgs[0].crisp_timestamp,
      last_message_at: msgs[msgs.length - 1].crisp_timestamp,
    })
    .eq("session_id", sessionId);
}

// ============================================
// Curseur
// ============================================

export async function getCursor(): Promise<string> {
  const { data } = await getCrispSupabase()
    .from("tchat_sync_cursor")
    .select("last_synced_at")
    .eq("website_id", getWebsiteId())
    .single();

  if (!data) {
    // Pas de curseur → commencer à J-1
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }
  return data.last_synced_at;
}

export async function updateCursor(
  lastSyncedAt: string,
  stats?: { messagesSynced: number; errors: number }
): Promise<void> {
  await getCrispSupabase()
    .from("tchat_sync_cursor")
    .upsert(
      {
        website_id: getWebsiteId(),
        last_synced_at: lastSyncedAt,
        last_run_at: new Date().toISOString(),
        last_run_messages_synced: stats?.messagesSynced ?? 0,
        last_run_errors: stats?.errors ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "website_id" }
    );
}

// ============================================
// Stats
// ============================================

export async function getSyncStats() {
  const sb = getCrispSupabase();
  const [convos, msgs, inbound, outbound] = await Promise.all([
    sb.from("tchat_conversations").select("*", { count: "exact", head: true }),
    sb.from("tchat_messages").select("*", { count: "exact", head: true }),
    sb.from("tchat_messages").select("*", { count: "exact", head: true }).eq("direction", "INBOUND"),
    sb.from("tchat_messages").select("*", { count: "exact", head: true }).eq("direction", "OUTBOUND"),
  ]);

  return {
    conversations: convos.count || 0,
    messages: msgs.count || 0,
    inbound: inbound.count || 0,
    outbound: outbound.count || 0,
  };
}

// ============================================
// Dédup batch : comparer updated_at Crisp vs Supabase
// ============================================

interface ConversationSyncStatus {
  newSessionIds: Set<string>;
  updatedSessionIds: Set<string>;
  unchangedCount: number;
}

export async function classifyConversations(
  crispConversations: Array<{ session_id: string; updated_at: number }>
): Promise<ConversationSyncStatus> {
  const sessionIds = crispConversations.map((c) => c.session_id);

  if (!sessionIds.length) {
    return { newSessionIds: new Set(), updatedSessionIds: new Set(), unchangedCount: 0 };
  }

  const { data } = await getCrispSupabase()
    .from("tchat_conversations")
    .select("session_id, updated_at")
    .in("session_id", sessionIds);

  const existing = new Map(
    (data || []).map((c) => [c.session_id, c.updated_at])
  );

  const newSessionIds = new Set<string>();
  const updatedSessionIds = new Set<string>();
  let unchangedCount = 0;

  for (const convo of crispConversations) {
    const storedUpdatedAt = existing.get(convo.session_id);

    if (!storedUpdatedAt) {
      newSessionIds.add(convo.session_id);
    } else {
      const crispDate = new Date(convo.updated_at).getTime();
      const supabaseDate = new Date(storedUpdatedAt).getTime();

      if (crispDate > supabaseDate) {
        updatedSessionIds.add(convo.session_id);
      } else {
        unchangedCount++;
      }
    }
  }

  return { newSessionIds, updatedSessionIds, unchangedCount };
}
