import { logger, schedules } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";
import { getSupabase } from "./lib/supabase.js";

// ============================================
// CONFIGURATION
// ============================================

const AI_BATCH_SIZE = 10;
const MAX_MESSAGES_PER_CONVERSATION = 15;

// ============================================
// LAZY SUPABASE CLIENT (tchat-support-sync)
// ============================================

let _client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.TCHAT_SUPPORT_SYNC_SUPABASE_URL!,
      process.env.TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY!
    );
  }
  return _client;
}

// ============================================
// TYPES
// ============================================

interface ActiveConversation {
  session_id: string;
  contact_name: string | null;
  contact_email: string | null;
  state: string;
  first_message_at: string;
  last_message_at: string;
  message_count_inbound: number;
  message_count_outbound: number;
  is_new: boolean; // first_message_at within the period
}

interface ConversationMessage {
  session_id: string;
  direction: string;
  content_type: string;
  crisp_timestamp: string;
  operator_name: string | null;
  operator_id: string | null;
  text: string;
}

interface ClassifiedConversation extends ActiveConversation {
  subject: string;
  type: "bug" | "question" | "feature_request" | "config" | "other";
  waiting_on: "support" | "client" | "resolved";
  close_suggestion: string | null;
  last_message_direction: string;
  messages: ConversationMessage[];
}

interface ThemeAnalysis {
  theme: string;
  count: number;
  summary: string;
}

interface OperatorStats {
  name: string;
  messageCount: number;
  conversationCount: number;
  toCloseCount: number;
}

// ============================================
// SCHEDULED TASK
// ============================================

export const weeklyCrispRecapTask = schedules.task({
  id: "weekly-crisp-recap",
  cron: "30 6 * * 5",
  maxDuration: 120,
  run: async () => {
    logger.info("=== START weekly-crisp-recap ===");
    const errors: TaskError[] = [];

    try {
      // Step 1 — Period: vendredi dernier 00h → maintenant (Europe/Paris)
      const { startISO, endISO, weekLabel } = getWeekBounds();
      logger.info(`Period: ${weekLabel} (${startISO} → ${endISO})`);

      // Step 2 — Fetch active conversations
      const conversations = await fetchActiveConversations(startISO, endISO);
      logger.info(`${conversations.length} active conversations`);

      if (conversations.length === 0) {
        await postToWebhook(`📊 *Recap Support Crisp — ${weekLabel}*\n\n✅ Aucune activité support cette semaine !`);
        return { success: true, conversations: 0 };
      }

      // Step 3 — Fetch messages for active conversations
      const messagesMap = await fetchWeekMessages(
        conversations.map((c) => c.session_id),
        startISO,
        endISO
      );
      logger.info(`Messages fetched for ${messagesMap.size} conversations`);

      // Step 3b — Load operator name mapping from workspace_team
      const operatorNameMap = await loadOperatorNameMap();

      // Step 4 — Compute basic stats + avg response time
      const newConversations = conversations.filter((c) => c.is_new);
      const resolvedConversations = conversations.filter((c) => c.state === "resolved");
      let totalInbound = 0;
      let totalOutbound = 0;
      for (const msgs of messagesMap.values()) {
        for (const m of msgs) {
          if (m.direction === "INBOUND") totalInbound++;
          else if (m.direction === "OUTBOUND") totalOutbound++;
        }
      }
      const avgResponseMinutes = computeAvgResponseTime(messagesMap);

      // Step 5 — AI classification of conversations
      const classified = await classifyConversations(conversations, messagesMap, errors);
      logger.info(`AI classified ${classified.length} conversations`);

      // Step 6 — Compute operator stats (needs classified for toCloseCount)
      const operatorStats = computeOperatorStats(messagesMap, classified, operatorNameMap);

      // Step 7 — AI global themes analysis
      const themes = await analyzeGlobalThemes(classified, errors);
      logger.info(`${themes.length} themes identified`);

      // Step 8 — Build and send Slack message
      const stats = {
        active: conversations.length,
        new: newConversations.length,
        resolved: resolvedConversations.length,
        totalInbound,
        totalOutbound,
        avgResponseMinutes,
      };
      await sendSlackRecap(weekLabel, classified, stats, operatorStats, themes);

      // Error reporting
      if (errors.length > 0) {
        await sendErrorToScriptLogs("Weekly Crisp Recap", [{
          label: "Exécution",
          inserted: classified.length,
          skipped: 0,
          errors,
        }]);
      }

      const summary = {
        success: true,
        conversations: conversations.length,
        classified: classified.length,
        bugs: classified.filter((c) => c.type === "bug").length,
        waitingSupport: classified.filter((c) => c.waiting_on === "support").length,
      };
      logger.info("=== SUMMARY ===", summary);
      return summary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Fatal error: ${msg}`);
      await sendErrorToScriptLogs("Weekly Crisp Recap", [{
        label: "Exécution",
        inserted: 0,
        skipped: 0,
        errors: [{ type: "Fatal", code: "exception", message: msg }],
      }]);
      throw err;
    }
  },
});

// ============================================
// WEEK BOUNDS (Europe/Paris)
// ============================================

function getWeekBounds() {
  const now = new Date();

  const parisFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const parts = parisFormatter.formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);

  const weekdayMap: Record<string, number> = {
    lundi: 1, mardi: 2, mercredi: 3, jeudi: 4,
    vendredi: 5, samedi: 6, dimanche: 0,
  };
  const weekdayName = parts.find((p) => p.type === "weekday")!.value.toLowerCase();
  const dayOfWeek = weekdayMap[weekdayName] ?? 0;

  // Last Friday 00:00 = start of period (7 days ago if today is Friday)
  const diffToLastFriday = dayOfWeek >= 5
    ? -(dayOfWeek - 5) - 7
    : -(dayOfWeek + 2);
  const todayUTC = new Date(Date.UTC(year, month - 1, day));
  const lastFridayUTC = new Date(todayUTC);
  lastFridayUTC.setUTCDate(lastFridayUTC.getUTCDate() + diffToLastFriday);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startISO = `${lastFridayUTC.getUTCFullYear()}-${pad(lastFridayUTC.getUTCMonth() + 1)}-${pad(lastFridayUTC.getUTCDate())}T00:00:00.000Z`;
  const endISO = `${todayUTC.getUTCFullYear()}-${pad(todayUTC.getUTCMonth() + 1)}-${pad(todayUTC.getUTCDate())}T08:30:00.000Z`;

  const weekLabel = `Vendredi ${pad(lastFridayUTC.getUTCDate())}/${pad(lastFridayUTC.getUTCMonth() + 1)} — Vendredi ${pad(todayUTC.getUTCDate())}/${pad(todayUTC.getUTCMonth() + 1)}`;

  return { startISO, endISO, weekLabel };
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchActiveConversations(
  startISO: string,
  endISO: string
): Promise<ActiveConversation[]> {
  const { data, error } = await db()
    .from("tchat_conversations")
    .select("session_id, contact_name, contact_email, state, first_message_at, last_message_at, message_count_inbound, message_count_outbound")
    .gte("last_message_at", startISO)
    .lte("last_message_at", endISO)
    .order("last_message_at", { ascending: false });

  if (error) throw new Error(`Supabase conversations: ${error.message}`);

  return (data ?? []).map((c: any) => ({
    ...c,
    is_new: c.first_message_at >= startISO,
  }));
}

async function fetchWeekMessages(
  sessionIds: string[],
  startISO: string,
  endISO: string
): Promise<Map<string, ConversationMessage[]>> {
  const result = new Map<string, ConversationMessage[]>();

  // Fetch in chunks of 20 session_ids to avoid too large IN clauses
  for (let i = 0; i < sessionIds.length; i += 20) {
    const chunk = sessionIds.slice(i, i + 20);

    const { data, error } = await db()
      .from("tchat_messages")
      .select("session_id, direction, content_type, crisp_timestamp, raw_data")
      .in("session_id", chunk)
      .gte("crisp_timestamp", startISO)
      .lte("crisp_timestamp", endISO)
      .order("crisp_timestamp", { ascending: true });

    if (error) throw new Error(`Supabase messages: ${error.message}`);

    for (const msg of data ?? []) {
      const raw = msg.raw_data ?? {};
      const operatorName = raw?.user?.nickname ?? null;
      const operatorId = raw?.user?.user_id ?? null;
      const text = typeof raw?.content === "string"
        ? raw.content
        : raw?.content?.text ?? raw?.content?.url ?? "";

      const entry: ConversationMessage = {
        session_id: msg.session_id,
        direction: msg.direction,
        content_type: msg.content_type,
        crisp_timestamp: msg.crisp_timestamp,
        operator_name: operatorName,
        operator_id: operatorId,
        text: text.substring(0, 500),
      };

      const list = result.get(msg.session_id) ?? [];
      list.push(entry);
      result.set(msg.session_id, list);
    }
  }

  return result;
}

// ============================================
// OPERATOR NAME MAPPING
// ============================================

async function loadOperatorNameMap(): Promise<Map<string, string>> {
  const nameMap = new Map<string, string>();
  try {
    const { data } = await getSupabase()
      .from("workspace_team")
      .select("crisp_operator_id, firstname, lastname")
      .not("crisp_operator_id", "is", null);
    for (const row of data ?? []) {
      if (row.crisp_operator_id && row.firstname) {
        nameMap.set(row.crisp_operator_id, `${row.firstname} ${row.lastname ?? ""}`.trim());
      }
    }
    logger.info(`Operator name mapping: ${nameMap.size} entries`);
  } catch (err) {
    logger.warn(`Failed to load operator name mapping: ${err instanceof Error ? err.message : String(err)}`);
  }
  return nameMap;
}

// ============================================
// OPERATOR STATS
// ============================================

function computeOperatorStats(
  messagesMap: Map<string, ConversationMessage[]>,
  classified: ClassifiedConversation[],
  operatorNameMap: Map<string, string>
): OperatorStats[] {
  // Group by operator_id (fallback to operator_name if no id)
  const stats = new Map<string, { name: string; messageCount: number; sessions: Set<string> }>();

  for (const [sessionId, messages] of messagesMap) {
    for (const msg of messages) {
      if (msg.direction !== "OUTBOUND" || (!msg.operator_id && !msg.operator_name)) continue;
      const key = msg.operator_id ?? msg.operator_name!;
      const displayName = (msg.operator_id && operatorNameMap.get(msg.operator_id)) ?? msg.operator_name ?? key;
      const existing = stats.get(key) ?? { name: displayName, messageCount: 0, sessions: new Set() };
      existing.messageCount++;
      existing.sessions.add(sessionId);
      stats.set(key, existing);
    }
  }

  // Find conversations to close: AI suggests closing AND Crisp state is still open
  const toCloseBySession = new Set(
    classified
      .filter((c) => c.close_suggestion?.startsWith("oui") && c.state !== "resolved")
      .map((c) => c.session_id)
  );

  // Attribute to-close conversations to the last operator who replied
  const lastOperatorBySession = new Map<string, string>();
  for (const [sessionId, messages] of messagesMap) {
    for (const msg of messages) {
      if (msg.direction === "OUTBOUND" && (msg.operator_id || msg.operator_name)) {
        lastOperatorBySession.set(sessionId, msg.operator_id ?? msg.operator_name!);
      }
    }
  }

  const toClosePerOperator = new Map<string, number>();
  for (const sessionId of toCloseBySession) {
    const operatorKey = lastOperatorBySession.get(sessionId);
    if (operatorKey) {
      toClosePerOperator.set(operatorKey, (toClosePerOperator.get(operatorKey) ?? 0) + 1);
    }
  }

  return Array.from(stats.entries())
    .map(([key, s]) => ({
      name: s.name,
      messageCount: s.messageCount,
      conversationCount: s.sessions.size,
      toCloseCount: toClosePerOperator.get(key) ?? 0,
    }))
    .sort((a, b) => b.messageCount - a.messageCount);
}

// ============================================
// AVERAGE RESPONSE TIME
// ============================================

function computeAvgResponseTime(
  messagesMap: Map<string, ConversationMessage[]>
): number | null {
  const deltas: number[] = [];

  for (const messages of messagesMap.values()) {
    let awaitingResponseSince: number | null = null;

    for (const msg of messages) {
      const ts = new Date(msg.crisp_timestamp).getTime();
      if (msg.direction === "INBOUND") {
        if (awaitingResponseSince === null) awaitingResponseSince = ts;
      } else if (msg.direction === "OUTBOUND" && awaitingResponseSince !== null) {
        deltas.push((ts - awaitingResponseSince) / 60000);
        awaitingResponseSince = null;
      }
    }
  }

  if (deltas.length === 0) return null;
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return "N/A";
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ============================================
// AI CLASSIFICATION (Claude Sonnet)
// ============================================

const CLASSIFICATION_SYSTEM_PROMPT = `Tu es un assistant qui analyse des conversations de support client pour AirSaas (SaaS de gestion de portefeuille de projets).

Pour chaque conversation, détermine :
1. "subject" : résumé en 10 mots max du sujet principal
2. "type" : une seule valeur parmi :
   - "bug" : le client signale un dysfonctionnement, erreur, crash, comportement inattendu
   - "question" : le client pose une question sur l'utilisation du produit
   - "feature_request" : le client demande une fonctionnalité qui n'existe pas
   - "config" : le client a besoin d'aide pour configurer/paramétrer quelque chose
   - "other" : tout le reste
3. "waiting_on" : qui doit agir maintenant ?
   - "support" : le dernier message est du client, l'équipe doit répondre
   - "client" : le dernier message est du support, on attend la réponse du client
   - "resolved" : la conversation est marquée comme résolue
4. "close_suggestion" : si la conversation N'EST PAS resolved (state != "resolved"), indique si elle devrait être fermée :
   - "oui — [raison courte]" si le sujet semble clos (client a remercié, problème résolu, pas de réponse depuis longtemps)
   - "non — [raison courte]" si le sujet est encore ouvert ou attend une action
   - null si la conversation est déjà resolved

Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks :
[{ "session_id": "...", "subject": "...", "type": "...", "waiting_on": "...", "close_suggestion": "..." }]`;

async function classifyConversations(
  conversations: ActiveConversation[],
  messagesMap: Map<string, ConversationMessage[]>,
  errors: TaskError[]
): Promise<ClassifiedConversation[]> {
  const results: ClassifiedConversation[] = [];

  // Build payloads
  const payloads: { conv: ActiveConversation; messages: ConversationMessage[] }[] = [];
  for (const conv of conversations) {
    const messages = messagesMap.get(conv.session_id) ?? [];
    payloads.push({ conv, messages });
  }

  // Process in batches
  for (let i = 0; i < payloads.length; i += AI_BATCH_SIZE) {
    const batch = payloads.slice(i, i + AI_BATCH_SIZE);

    try {
      const classified = await classifyBatch(batch);
      results.push(...classified);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`AI classification error batch ${i}: ${msg}`);
      errors.push({ type: "AI Classification", code: "exception", message: msg });

      // Fallback: use basic heuristics
      for (const { conv, messages } of batch) {
        const lastMsg = messages[messages.length - 1];
        results.push({
          ...conv,
          subject: conv.contact_name ?? "Conversation",
          type: "other",
          waiting_on: conv.state === "resolved"
            ? "resolved"
            : lastMsg?.direction === "INBOUND" ? "support" : "client",
          close_suggestion: null,
          last_message_direction: lastMsg?.direction ?? "unknown",
          messages,
        });
      }
    }

    if (i + AI_BATCH_SIZE < payloads.length) await sleep(2000);
  }

  return results;
}

async function classifyBatch(
  batch: { conv: ActiveConversation; messages: ConversationMessage[] }[]
): Promise<ClassifiedConversation[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const payload = batch.map(({ conv, messages }) => {
    // Take last N messages for context
    const recentMessages = messages.slice(-MAX_MESSAGES_PER_CONVERSATION);
    const transcript = recentMessages.map((m) => {
      const role = m.direction === "INBOUND" ? "[CLIENT]" : `[SUPPORT${m.operator_name ? ` ${m.operator_name}` : ""}]`;
      return `${role} ${m.text}`;
    }).join("\n");

    return {
      session_id: conv.session_id,
      contact_name: conv.contact_name,
      contact_email: conv.contact_email,
      state: conv.state,
      transcript,
    };
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    temperature: 0,
    system: CLASSIFICATION_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Analyse ces ${batch.length} conversations support :\n\n${JSON.stringify(payload, null, 2)}`,
    }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const parsed = JSON.parse(textBlock.text) as {
    session_id: string;
    subject: string;
    type: ClassifiedConversation["type"];
    waiting_on: ClassifiedConversation["waiting_on"];
    close_suggestion: string | null;
  }[];

  const classMap = new Map(parsed.map((p) => [p.session_id, p]));

  return batch.map(({ conv, messages }) => {
    const cls = classMap.get(conv.session_id);
    const lastMsg = messages[messages.length - 1];
    return {
      ...conv,
      subject: cls?.subject ?? conv.contact_name ?? "—",
      type: cls?.type ?? "other",
      waiting_on: cls?.waiting_on ?? (conv.state === "resolved" ? "resolved" : "support"),
      close_suggestion: cls?.close_suggestion ?? null,
      last_message_direction: lastMsg?.direction ?? "unknown",
      messages,
    };
  });
}

// ============================================
// AI GLOBAL THEMES ANALYSIS
// ============================================

async function analyzeGlobalThemes(
  classified: ClassifiedConversation[],
  errors: TaskError[]
): Promise<ThemeAnalysis[]> {
  if (classified.length < 2) return [];

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const summaries = classified.map((c) => ({
      subject: c.subject,
      type: c.type,
      contact_name: c.contact_name,
    }));

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      temperature: 0,
      system: `Tu analyses les sujets de conversations de support client AirSaas (SaaS de gestion de portefeuille de projets) pour identifier les grandes tendances de la semaine.

Identifie 3 à 5 thèmes principaux regroupant les conversations. Pour chaque thème :
- "theme" : nom court du thème (3-5 mots)
- "count" : nombre de conversations liées
- "summary" : résumé en 1 phrase de ce que les clients demandent sur ce thème

Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks :
[{ "theme": "...", "count": N, "summary": "..." }]`,
      messages: [{
        role: "user",
        content: `Voici les ${classified.length} conversations de la semaine :\n\n${JSON.stringify(summaries, null, 2)}`,
      }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return [];

    return JSON.parse(textBlock.text) as ThemeAnalysis[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Themes analysis error: ${msg}`);
    errors.push({ type: "AI Themes", code: "exception", message: msg });
    return [];
  }
}

// ============================================
// SLACK RECAP
// ============================================

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

function companyFromEmail(email: string | null): string | null {
  if (!email) return null;
  const domain = email.split("@")[1];
  if (!domain) return null;
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatConversationLine(c: ClassifiedConversation): string {
  const name = c.contact_name ?? "Anonyme";
  const company = companyFromEmail(c.contact_email);
  const companyStr = company ? ` (${company})` : "";
  const ago = timeAgo(c.last_message_at);
  return `• *${name}*${companyStr} — ${c.subject} — _${ago}_`;
}

async function sendSlackRecap(
  weekLabel: string,
  classified: ClassifiedConversation[],
  stats: { active: number; new: number; resolved: number; totalInbound: number; totalOutbound: number; avgResponseMinutes: number | null },
  operatorStats: OperatorStats[],
  themes: ThemeAnalysis[]
): Promise<void> {
  let text = `📊 *Recap Support Crisp — ${weekLabel}*\n`;

  // Activity stats
  text += `\n🔢 *Activité*\n`;
  text += `• ${stats.active} conversations actives (${stats.new} nouvelles, ${stats.resolved} résolues)\n`;
  text += `• ${stats.totalInbound} messages clients / ${stats.totalOutbound} réponses support\n`;
  text += `• Temps de réponse moyen : ${formatResponseTime(stats.avgResponseMinutes)}\n`;

  // Operator stats
  if (operatorStats.length > 0) {
    text += `\n👥 *Opérateurs*\n`;
    for (const op of operatorStats) {
      const closeStr = op.toCloseCount > 0 ? ` — ${op.toCloseCount} à fermer sur Crisp` : "";
      text += `• ${op.name}: ${op.messageCount} réponses (${op.conversationCount} conversations)${closeStr}\n`;
    }
  }

  // Global themes
  if (themes.length > 0) {
    text += `\n🎯 *Sujets de la semaine*\n`;
    for (const t of themes) {
      text += `• *${t.theme}* (${t.count}) — ${t.summary}\n`;
    }
  }

  // Bugs
  const bugs = classified.filter((c) => c.type === "bug");
  if (bugs.length > 0) {
    text += `\n🐛 *Bugs remontés (${bugs.length})*\n`;
    for (const c of bugs) {
      text += formatConversationLine(c) + "\n";
    }
  }

  // Waiting on support
  const waitingSupport = classified.filter((c) => c.waiting_on === "support");
  if (waitingSupport.length > 0) {
    text += `\n⏳ *En attente de notre réponse (${waitingSupport.length})*\n`;
    for (const c of waitingSupport) {
      text += formatConversationLine(c) + "\n";
    }
  }

  // Waiting on client
  const waitingClient = classified.filter((c) => c.waiting_on === "client");
  if (waitingClient.length > 0) {
    text += `\n✅ *En attente du client (${waitingClient.length})*\n`;
    for (const c of waitingClient) {
      text += formatConversationLine(c) + "\n";
    }
  }

  // Feature requests
  const featureRequests = classified.filter((c) => c.type === "feature_request" && c.waiting_on !== "resolved");
  if (featureRequests.length > 0) {
    text += `\n💡 *Demandes de fonctionnalités (${featureRequests.length})*\n`;
    for (const c of featureRequests) {
      text += formatConversationLine(c) + "\n";
    }
  }

  // Close suggestions
  const toClose = classified.filter((c) => c.close_suggestion?.startsWith("oui"));
  if (toClose.length > 0) {
    text += `\n🔒 *Conversations à fermer ? (${toClose.length})*\n`;
    for (const c of toClose) {
      const name = c.contact_name ?? "Anonyme";
      const company = companyFromEmail(c.contact_email);
      const companyStr = company ? ` (${company})` : "";
      text += `• *${name}*${companyStr} — ${c.subject} — _${c.close_suggestion}_\n`;
    }
  }

  text += `\n_Classifié par Claude Sonnet_`;

  await postToWebhook(text);
}

async function postToWebhook(text: string): Promise<void> {
  const webhookUrl = process.env.script_logs;
  if (!webhookUrl) {
    logger.error("script_logs webhook not configured");
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      logger.info("Slack recap sent");
    } else {
      const body = await res.text();
      logger.error(`Slack webhook failed: ${res.status} — ${body}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Slack webhook error: ${msg}`);
  }
}
