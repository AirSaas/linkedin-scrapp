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
// HubSpot communication ID update
// ============================================

export async function updateCrispMessageHubSpotId(
  fingerprint: string,
  hubspotCommunicationId: string
): Promise<void> {
  const { error } = await getCrispSupabase()
    .from("tchat_messages")
    .update({ hubspot_communication_id: hubspotCommunicationId })
    .eq("fingerprint", fingerprint);

  if (error) {
    logger.error(`Failed to update hubspot_communication_id for ${fingerprint}: ${error.message}`);
  }
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
// Curseur batch (table temporaire tchat_batch_cursor_tmp)
// ============================================

export interface BatchCursor {
  nextPage: number;
  lastRunAt: string | null;
  isDone: boolean;
}

export async function getBatchCursor(): Promise<BatchCursor> {
  const { data } = await getCrispSupabase()
    .from("tchat_batch_cursor_tmp")
    .select("next_page, last_run_at, is_done")
    .eq("website_id", getWebsiteId())
    .single();

  if (!data) {
    return { nextPage: 1, lastRunAt: null, isDone: false };
  }
  return {
    nextPage: data.next_page,
    lastRunAt: data.last_run_at,
    isDone: data.is_done,
  };
}

export async function updateBatchCursor(
  nextPage: number,
  isDone: boolean
): Promise<void> {
  await getCrispSupabase()
    .from("tchat_batch_cursor_tmp")
    .upsert(
      {
        website_id: getWebsiteId(),
        next_page: nextPage,
        last_run_at: new Date().toISOString(),
        is_done: isDone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "website_id" }
    );
}

// ============================================
// FAQ extraction cursor + data
// ============================================

export interface FaqCursor {
  lastProcessedOffset: number;
  totalConversations: number | null;
  isDone: boolean;
  lastRunAt: string | null;
}

export async function getFaqCursor(): Promise<FaqCursor> {
  const { data } = await getCrispSupabase()
    .from("tchat_faq_cursor")
    .select("last_processed_offset, total_conversations, is_done, last_run_at")
    .eq("id", "default")
    .single();

  if (!data) {
    return { lastProcessedOffset: 0, totalConversations: null, isDone: false, lastRunAt: null };
  }
  return {
    lastProcessedOffset: data.last_processed_offset,
    totalConversations: data.total_conversations,
    isDone: data.is_done,
    lastRunAt: data.last_run_at,
  };
}

export async function updateFaqCursor(
  offset: number,
  isDone: boolean,
  totalConversations?: number
): Promise<void> {
  const update: Record<string, unknown> = {
    id: "default",
    last_processed_offset: offset,
    is_done: isDone,
    last_run_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (totalConversations !== undefined) {
    update.total_conversations = totalConversations;
  }
  await getCrispSupabase()
    .from("tchat_faq_cursor")
    .upsert(update, { onConflict: "id" });
}

export async function getConversationsForFaq(
  offset: number,
  limit: number,
  since?: string
): Promise<Array<{ session_id: string; contact_name: string | null; first_message_at: string; last_message_at: string; message_count_inbound: number; message_count_outbound: number }>> {
  const sinceDate = since ?? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

  let query = getCrispSupabase()
    .from("tchat_conversations")
    .select("session_id, contact_name, first_message_at, last_message_at, message_count_inbound, message_count_outbound")
    .gte("first_message_at", sinceDate)
    .order("first_message_at", { ascending: true });

  if (since) {
    // Incremental mode: also include conversations updated since last run
    query = getCrispSupabase()
      .from("tchat_conversations")
      .select("session_id, contact_name, first_message_at, last_message_at, message_count_inbound, message_count_outbound")
      .gte("last_message_at", sinceDate)
      .order("last_message_at", { ascending: true })
      .range(offset, offset + limit - 1);
  } else {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`getConversationsForFaq: ${error.message}`);
  }

  // Filter conversations with at least 3 messages
  return (data || []).filter(
    (c) => (c.message_count_inbound || 0) + (c.message_count_outbound || 0) >= 3
  );
}

export async function getMessagesForConversation(
  sessionId: string
): Promise<Array<{ direction: string; content: string; content_type: string; sender_name: string | null; crisp_timestamp: string }>> {
  const { data, error } = await getCrispSupabase()
    .from("tchat_messages")
    .select("direction, content, content_type, sender_name, crisp_timestamp")
    .eq("session_id", sessionId)
    .order("crisp_timestamp", { ascending: true });

  if (error) {
    throw new Error(`getMessagesForConversation: ${error.message}`);
  }
  return data || [];
}

export async function upsertFaqExtraction(
  sessionId: string,
  contactName: string | null,
  conversationDate: string,
  extractions: unknown[],
  modelUsed: string
): Promise<void> {
  const { error } = await getCrispSupabase()
    .from("tchat_faq_extractions")
    .upsert(
      {
        session_id: sessionId,
        contact_name: contactName,
        conversation_date: conversationDate,
        extractions,
        model_used: modelUsed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id" }
    );

  if (error) {
    throw new Error(`upsertFaqExtraction: ${error.message}`);
  }
}

// ============================================
// FAQ document generation
// ============================================

export interface FaqEntry {
  session_id: string;
  explicit_question: string;
  underlying_need: string;
  theme: string;
  product_terms: string[];
  signal: string;
  faq_score: number;
  faq_score_reason: string;
  suggested_faq_title: string;
  suggested_faq_answer: string;
  source_quotes: string[];
  circle_references: Array<{ title: string; url: string }>;
  [key: string]: unknown;
}

export async function getAllFaqExtractions(minScore: number): Promise<FaqEntry[]> {
  const sb = getCrispSupabase();
  const PAGE_SIZE = 1000;
  const allEntries: FaqEntry[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await sb
      .from("tchat_faq_extractions")
      .select("session_id, extractions")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`getAllFaqExtractions: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const extractions = typeof row.extractions === "string"
        ? JSON.parse(row.extractions)
        : row.extractions;

      if (!Array.isArray(extractions)) continue;

      for (const entry of extractions) {
        if ((entry.faq_score ?? 0) >= minScore) {
          allEntries.push({ ...entry, session_id: row.session_id });
        }
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allEntries;
}

export async function insertFaqDocument(
  markdown: string,
  modelUsed: string,
  stats: Record<string, unknown>,
  docMetadata: Record<string, unknown>
): Promise<number> {
  const sb = getCrispSupabase();

  // Get next version
  const { data: maxRow } = await sb
    .from("tchat_faq_documents")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRow?.version ?? 0) + 1;

  const { error } = await sb
    .from("tchat_faq_documents")
    .insert({
      version: nextVersion,
      generated_at: new Date().toISOString(),
      model_used: modelUsed,
      markdown,
      stats,
      metadata: docMetadata,
    });

  if (error) throw new Error(`insertFaqDocument: ${error.message}`);
  return nextVersion;
}

// ============================================
// Doc audit items (resume support)
// ============================================

export interface DocAuditItem {
  audit_run_id: string;
  article_url: string | null;
  article_name: string | null;
  audit_type: string;
  analysis: string;
  image_mapping: Record<string, string> | null;
  status: string;
}

export async function getCompletedAuditUrls(maxAgeHours: number = 24): Promise<Set<string>> {
  const since = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  const { data } = await getCrispSupabase()
    .from("tchat_doc_audit_items")
    .select("article_url")
    .eq("status", "done")
    .gte("created_at", since);

  return new Set((data || []).map((r) => r.article_url).filter(Boolean));
}

export async function insertAuditItem(item: DocAuditItem): Promise<void> {
  const { error } = await getCrispSupabase()
    .from("tchat_doc_audit_items")
    .insert({
      audit_run_id: item.audit_run_id,
      article_url: item.article_url,
      article_name: item.article_name,
      audit_type: item.audit_type,
      analysis: item.analysis,
      image_mapping: item.image_mapping,
      status: item.status,
    });

  if (error) throw new Error(`insertAuditItem: ${error.message}`);
}

export async function getAuditItemsByRunId(runId: string): Promise<DocAuditItem[]> {
  const { data, error } = await getCrispSupabase()
    .from("tchat_doc_audit_items")
    .select("*")
    .eq("audit_run_id", runId)
    .eq("status", "done")
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getAuditItemsByRunId: ${error.message}`);
  return data || [];
}

export async function insertFaqDocumentWithType(
  markdown: string,
  modelUsed: string,
  stats: Record<string, unknown>,
  docMetadata: Record<string, unknown>,
  type: string
): Promise<number> {
  const sb = getCrispSupabase();

  const { data: maxRow } = await sb
    .from("tchat_faq_documents")
    .select("version")
    .eq("type", type)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRow?.version ?? 0) + 1;

  const { error } = await sb
    .from("tchat_faq_documents")
    .insert({
      version: nextVersion,
      generated_at: new Date().toISOString(),
      model_used: modelUsed,
      markdown,
      stats,
      metadata: docMetadata,
      type,
    });

  if (error) throw new Error(`insertFaqDocumentWithType: ${error.message}`);
  return nextVersion;
}

// ============================================
// Circle posts fetch (for audit)
// ============================================

export interface CirclePostForAudit {
  id: number;
  name: string;
  url: string;
  space_slug: string;
  space_name: string;
  body_html: string;
  body_plain_text: string | null;
  comments: unknown[] | null;
  comments_count: number;
  published_at: string;
}

export async function getAllCirclePosts(): Promise<CirclePostForAudit[]> {
  const sb = getCrispSupabase();
  const { data, error } = await sb
    .from("circle_posts")
    .select("id, name, url, space_slug, space_name, body_html, body_plain_text, comments, comments_count, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) throw new Error(`getAllCirclePosts: ${error.message}`);
  return (data || []) as CirclePostForAudit[];
}

// ============================================
// FAQ approved reference
// ============================================

export async function getFaqApproved(): Promise<{ markdown: string; version: number; generated_at: string } | null> {
  const { data, error } = await getCrispSupabase()
    .from("tchat_faq_documents")
    .select("markdown, version, generated_at")
    .eq("type", "faq_approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`getFaqApproved: ${error.message}`);
  return data;
}

export async function upsertFaqApproved(markdown: string): Promise<number> {
  const sb = getCrispSupabase();

  // Check if an approved FAQ already exists
  const { data: existing } = await sb
    .from("tchat_faq_documents")
    .select("id, version")
    .eq("type", "faq_approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Update existing entry
    const { error } = await sb
      .from("tchat_faq_documents")
      .update({
        markdown,
        generated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) throw new Error(`upsertFaqApproved update: ${error.message}`);
    return existing.version;
  } else {
    // Insert new entry
    return insertFaqDocumentWithType(markdown, "manual", {}, {}, "faq_approved");
  }
}

// ============================================
// Recent FAQ extractions & Circle posts (for propose-faq-updates)
// ============================================

export async function getRecentFaqExtractions(sinceDays: number): Promise<FaqEntry[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const sb = getCrispSupabase();
  const PAGE_SIZE = 1000;
  const allEntries: FaqEntry[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await sb
      .from("tchat_faq_extractions")
      .select("session_id, extractions, updated_at")
      .gte("updated_at", since)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`getRecentFaqExtractions: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const extractions = typeof row.extractions === "string"
        ? JSON.parse(row.extractions)
        : row.extractions;

      if (!Array.isArray(extractions)) continue;

      for (const entry of extractions) {
        if ((entry.faq_score ?? 0) >= 3) {
          allEntries.push({ ...entry, session_id: row.session_id });
        }
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allEntries;
}

export async function getRecentCirclePosts(sinceDays: number): Promise<CirclePostForAudit[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await getCrispSupabase()
    .from("circle_posts")
    .select("id, name, url, space_slug, space_name, body_html, body_plain_text, comments, comments_count, published_at")
    .eq("status", "published")
    .gte("updated_at", since)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`getRecentCirclePosts: ${error.message}`);
  return (data || []) as CirclePostForAudit[];
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
