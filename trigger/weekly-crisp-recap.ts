import { logger, schedules } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";

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
  text: string;
}

interface ClassifiedConversation extends ActiveConversation {
  subject: string;
  type: "bug" | "question" | "feature_request" | "config" | "other";
  waiting_on: "support" | "client" | "resolved";
  last_message_direction: string;
  messages: ConversationMessage[];
}

interface OperatorStats {
  name: string;
  messageCount: number;
  conversationCount: number;
}

// ============================================
// SCHEDULED TASK
// ============================================

export const weeklyCrispRecapTask = schedules.task({
  id: "weekly-crisp-recap",
  maxDuration: 120,
  run: async () => {
    logger.info("=== START weekly-crisp-recap ===");
    const errors: TaskError[] = [];

    try {
      // Step 1 — Period: dimanche 00h → vendredi 8h30 (Europe/Paris)
      const { sundayISO, fridayISO, weekLabel } = getWeekBounds();
      logger.info(`Period: ${weekLabel} (${sundayISO} → ${fridayISO})`);

      // Step 2 — Fetch active conversations
      const conversations = await fetchActiveConversations(sundayISO, fridayISO);
      logger.info(`${conversations.length} active conversations`);

      if (conversations.length === 0) {
        await postToWebhook(`📊 *Recap Support Crisp — ${weekLabel}*\n\n✅ Aucune activité support cette semaine !`);
        return { success: true, conversations: 0 };
      }

      // Step 3 — Fetch messages for active conversations
      const messagesMap = await fetchWeekMessages(
        conversations.map((c) => c.session_id),
        sundayISO,
        fridayISO
      );
      logger.info(`Messages fetched for ${messagesMap.size} conversations`);

      // Step 4 — Compute operator stats from messages
      const operatorStats = computeOperatorStats(messagesMap);

      // Step 5 — Compute basic stats
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

      // Step 6 — AI classification of conversations
      const classified = await classifyConversations(conversations, messagesMap, errors);
      logger.info(`AI classified ${classified.length} conversations`);

      // Step 7 — Build and send Slack message
      const stats = {
        active: conversations.length,
        new: newConversations.length,
        resolved: resolvedConversations.length,
        totalInbound,
        totalOutbound,
      };
      await sendSlackRecap(weekLabel, classified, stats, operatorStats);

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

  // Sunday = start of period
  const diffToSunday = dayOfWeek === 0 ? 0 : -dayOfWeek;
  const todayUTC = new Date(Date.UTC(year, month - 1, day));
  const sundayUTC = new Date(todayUTC);
  sundayUTC.setUTCDate(sundayUTC.getUTCDate() + diffToSunday);

  const fridayUTC = new Date(sundayUTC);
  fridayUTC.setUTCDate(fridayUTC.getUTCDate() + 5);

  const pad = (n: number) => String(n).padStart(2, "0");
  const sundayISO = `${sundayUTC.getUTCFullYear()}-${pad(sundayUTC.getUTCMonth() + 1)}-${pad(sundayUTC.getUTCDate())}T00:00:00.000Z`;
  const fridayISO = `${fridayUTC.getUTCFullYear()}-${pad(fridayUTC.getUTCMonth() + 1)}-${pad(fridayUTC.getUTCDate())}T08:30:00.000Z`;

  const monthNames = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const weekLabel = `Semaine du ${sundayUTC.getUTCDate()} ${monthNames[sundayUTC.getUTCMonth()]} ${sundayUTC.getUTCFullYear()}`;

  return { sundayISO, fridayISO, weekLabel };
}

// ============================================
// DATA FETCHING
// ============================================

async function fetchActiveConversations(
  sundayISO: string,
  fridayISO: string
): Promise<ActiveConversation[]> {
  const { data, error } = await db()
    .from("tchat_conversations")
    .select("session_id, contact_name, contact_email, state, first_message_at, last_message_at, message_count_inbound, message_count_outbound")
    .gte("last_message_at", sundayISO)
    .lte("last_message_at", fridayISO)
    .order("last_message_at", { ascending: false });

  if (error) throw new Error(`Supabase conversations: ${error.message}`);

  return (data ?? []).map((c: any) => ({
    ...c,
    is_new: c.first_message_at >= sundayISO,
  }));
}

async function fetchWeekMessages(
  sessionIds: string[],
  sundayISO: string,
  fridayISO: string
): Promise<Map<string, ConversationMessage[]>> {
  const result = new Map<string, ConversationMessage[]>();

  // Fetch in chunks of 20 session_ids to avoid too large IN clauses
  for (let i = 0; i < sessionIds.length; i += 20) {
    const chunk = sessionIds.slice(i, i + 20);

    const { data, error } = await db()
      .from("tchat_messages")
      .select("session_id, direction, content_type, crisp_timestamp, raw_data")
      .in("session_id", chunk)
      .gte("crisp_timestamp", sundayISO)
      .lte("crisp_timestamp", fridayISO)
      .order("crisp_timestamp", { ascending: true });

    if (error) throw new Error(`Supabase messages: ${error.message}`);

    for (const msg of data ?? []) {
      const raw = msg.raw_data ?? {};
      const operatorName = raw?.user?.nickname ?? null;
      const text = typeof raw?.content === "string"
        ? raw.content
        : raw?.content?.text ?? raw?.content?.url ?? "";

      const entry: ConversationMessage = {
        session_id: msg.session_id,
        direction: msg.direction,
        content_type: msg.content_type,
        crisp_timestamp: msg.crisp_timestamp,
        operator_name: operatorName,
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
// OPERATOR STATS
// ============================================

function computeOperatorStats(
  messagesMap: Map<string, ConversationMessage[]>
): OperatorStats[] {
  const stats = new Map<string, { messageCount: number; sessions: Set<string> }>();

  for (const [sessionId, messages] of messagesMap) {
    for (const msg of messages) {
      if (msg.direction !== "OUTBOUND" || !msg.operator_name) continue;
      const name = msg.operator_name;
      const existing = stats.get(name) ?? { messageCount: 0, sessions: new Set() };
      existing.messageCount++;
      existing.sessions.add(sessionId);
      stats.set(name, existing);
    }
  }

  return Array.from(stats.entries())
    .map(([name, s]) => ({
      name,
      messageCount: s.messageCount,
      conversationCount: s.sessions.size,
    }))
    .sort((a, b) => b.messageCount - a.messageCount);
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

Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks :
[{ "session_id": "...", "subject": "...", "type": "...", "waiting_on": "..." }]`;

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
      last_message_direction: lastMsg?.direction ?? "unknown",
      messages,
    };
  });
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
  stats: { active: number; new: number; resolved: number; totalInbound: number; totalOutbound: number },
  operatorStats: OperatorStats[]
): Promise<void> {
  let text = `📊 *Recap Support Crisp — ${weekLabel}*\n`;

  // Activity stats
  text += `\n🔢 *Activité*\n`;
  text += `• ${stats.active} conversations actives (${stats.new} nouvelles, ${stats.resolved} résolues)\n`;
  text += `• ${stats.totalInbound} messages clients / ${stats.totalOutbound} réponses support\n`;

  // Operator stats
  if (operatorStats.length > 0) {
    text += `\n👥 *Opérateurs*\n`;
    for (const op of operatorStats) {
      text += `• ${op.name}: ${op.messageCount} réponses (${op.conversationCount} conversations)\n`;
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

  // Feature requests / questions
  const featureRequests = classified.filter((c) => c.type === "feature_request" && c.waiting_on !== "resolved");
  if (featureRequests.length > 0) {
    text += `\n💡 *Demandes de fonctionnalités (${featureRequests.length})*\n`;
    for (const c of featureRequests) {
      text += formatConversationLine(c) + "\n";
    }
  }

  text += `\n_Classifié par Claude Sonnet_`;

  await postToWebhook(text);
}

async function postToWebhook(text: string): Promise<void> {
  const webhookUrl = process.env.webhook_crisp_recap;
  if (!webhookUrl) {
    logger.error("webhook_crisp_recap not configured");
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
