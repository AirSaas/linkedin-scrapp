import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sendErrorToScriptLogs, type TaskError, type TaskResultGroup } from "./lib/utils.js";
import {
  getFaqCursor,
  updateFaqCursor,
  getConversationsForFaq,
  getMessagesForConversation,
  upsertFaqExtraction,
} from "./lib/crisp-supabase.js";

// ============================================
// CONFIGURATION
// ============================================

const BATCH_SIZE = 10;
const DELAY_BETWEEN_CHILDREN_S = 30;
const MODEL = "claude-opus-4-20250514";
const MAX_TOKENS = 16000;
const TEMPERATURE = 0.3;

// ============================================
// PROMPT
// ============================================

const SYSTEM_PROMPT = `Tu es un expert en analyse de conversations support pour un SaaS B2B de gestion de projets (AirSaas / PRC).

Ta mission : extraire de cette conversation support les éléments qui méritent d'être dans une FAQ produit intelligente.

IMPORTANT : une conversation Crisp peut contenir PLUSIEURS sujets/questions distincts étalés sur des semaines ou mois. Extrais CHAQUE sujet comme une entrée FAQ séparée.

Pour chaque sujet identifié, analyse en profondeur :

1. LA QUESTION EXPLICITE — ce que le client demande littéralement, mot pour mot.

2. LE VRAI BESOIN SOUS-JACENT — souvent le client pose une question surface mais le vrai besoin est différent. Exemple : "où est la doc sur les TJM ?" → le vrai besoin c'est "je veux comprendre comment fonctionnent les coûts humains de mes projets". Creuse pour trouver ce que le client cherche VRAIMENT à accomplir.

3. LE PARCOURS DE DIAGNOSTIC — les questions que le support a dû poser pour comprendre le contexte (quel espace, quelle config, quel use case, quel rôle utilisateur). Ces questions sont de l'or pour la FAQ : elles deviennent les "prérequis" ou les "cas de figure" dans la réponse. Si le support a dû enquêter, c'est que la question n'est pas triviale et nécessite du contexte.

4. LE SIGNAL — qu'est-ce que cette conversation révèle sur le produit :
   - documentation_missing : la doc n'existe pas ou est insuffisante
   - feature_misunderstood : la feature existe mais le client ne la comprend pas
   - bug_report : c'est un bug confirmé
   - ux_confusion : l'interface prête à confusion, le client ne trouve pas la feature
   - feature_request : le client demande une feature qui n'existe pas
   - onboarding_gap : le client n'a pas été formé sur ce point clé
   - ask_setting : le client demande comment configurer/paramétrer quelque chose

5. SCORE FAQ (1-5) — cette question mérite-t-elle un article FAQ ?
   - 5 = question universelle, applicable à tous les clients, revient souvent
   - 4 = question fréquente, bonne candidate FAQ
   - 3 = question intéressante mais contexte un peu spécifique
   - 2 = cas très particulier à ce client
   - 1 = pas pertinent pour une FAQ (bavardage, problème one-shot)

6. RÉPONSE FAQ SUGGÉRÉE — à partir des réponses RÉELLES données par le support dans la conversation, rédige une réponse FAQ claire, structurée et actionnable. Inclus les étapes concrètes, les liens mentionnés, et les cas de figure identifiés lors du diagnostic. La réponse doit être autonome (compréhensible sans lire la conversation).

RÈGLES :
- Les messages marqués [NOTE INTERNE] sont des notes privées du support — utilise-les pour le contexte mais ne les cite pas dans la FAQ
- Les messages marqués [FICHIER: ...] indiquent qu'un fichier/screenshot a été partagé — mentionne-le dans file_references
- Si la conversation ne contient aucun sujet FAQ pertinent (bavardage, spam, test), retourne []
- Sois exigeant sur le score : une vraie FAQ doit aider d'AUTRES clients, pas juste ce client précis

Réponds UNIQUEMENT en JSON valide, un tableau d'objets. Pas de markdown, pas de backticks, pas de commentaires.`;

// ============================================
// CHILD TASK: process a single conversation
// ============================================

export const extractFaqSingleConversation = task({
  id: "extract-faq-single-conversation",
  maxDuration: 600, // 10 min max per conversation
  run: async (payload: { sessionId: string; contactName: string | null; firstMessageAt: string; lastMessageAt: string }) => {
    const label = `${payload.contactName || "unknown"} (${payload.sessionId.slice(0, 12)}...)`;
    logger.info(`Processing conversation: ${label}`);

    // 1. Fetch messages (only < 1 year old)
    const messages = await getMessagesForConversation(payload.sessionId);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    let recentMessages = messages.filter((m) => m.crisp_timestamp >= oneYearAgo);

    if (recentMessages.length < 3) {
      logger.info(`Skipping ${label}: only ${recentMessages.length} recent messages`);
      return { skipped: true, reason: "too_few_messages", messageCount: recentMessages.length };
    }

    // Cap to last 200 messages to avoid Claude Opus timeout on very long conversations
    if (recentMessages.length > 200) {
      logger.info(`Truncating ${label}: ${recentMessages.length} → 200 messages (keeping most recent)`);
      recentMessages = recentMessages.slice(-200);
    }

    // 2. Build transcript
    const transcript = buildTranscript(recentMessages);
    logger.info(`Transcript: ${recentMessages.length} messages, ${transcript.length} chars`);

    // 3. Call Claude
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const extractions = await callClaude(client, payload, transcript);

    // 4. Save
    await upsertFaqExtraction(
      payload.sessionId,
      payload.contactName,
      payload.firstMessageAt,
      extractions,
      MODEL
    );

    const faqCount = extractions.filter((e) => ((e as Record<string, unknown>).faq_score as number ?? 0) >= 3).length;
    logger.info(`${label}: ${extractions.length} entries extracted (${faqCount} with score >= 3)`);

    return {
      sessionId: payload.sessionId,
      contactName: payload.contactName,
      entriesExtracted: extractions.length,
      faqScore3Plus: faqCount,
      messageCount: recentMessages.length,
      transcriptLength: transcript.length,
    };
  },
});

// ============================================
// ORCHESTRATOR TASK: batch + fire-and-forget children
// ============================================

export const extractFaqFromCrisp = task({
  id: "extract-faq-from-crisp",
  maxDuration: 60, // Orchestrator is fast — just triggers children
  run: async () => {
    logger.info("=== START extract-faq-from-crisp (orchestrator) ===");

    // 1. Read cursor
    const cursor = await getFaqCursor();
    if (cursor.isDone) {
      logger.info("FAQ extraction already done, skipping");
      return { skipped: true, reason: "done" };
    }

    const offset = cursor.lastProcessedOffset;
    logger.info(`Starting from offset ${offset}`);

    // 2. Fetch conversations
    const conversations = await getConversationsForFaq(offset, BATCH_SIZE + 10);

    if (conversations.length === 0) {
      logger.info("No more conversations to process, marking done");
      await updateFaqCursor(offset, true);
      await sendFaqCompletionSlack(offset);
      return { done: true, totalProcessed: offset };
    }

    const batch = conversations.slice(0, BATCH_SIZE);
    logger.info(`Triggering ${batch.length} child tasks (offset ${offset})`);

    // 3. Fire-and-forget: trigger each child with staggered delay
    const triggered: string[] = [];
    for (let i = 0; i < batch.length; i++) {
      const convo = batch[i];
      const delaySeconds = i * DELAY_BETWEEN_CHILDREN_S;

      const handle = await extractFaqSingleConversation.trigger(
        {
          sessionId: convo.session_id,
          contactName: convo.contact_name,
          firstMessageAt: convo.first_message_at,
          lastMessageAt: convo.last_message_at,
        },
        delaySeconds > 0 ? { delay: `${delaySeconds}s` } : undefined
      );

      triggered.push(`${convo.contact_name || "unknown"} (delay ${delaySeconds}s, run ${handle.id})`);
      logger.info(`Triggered child ${i + 1}/${batch.length}: ${convo.contact_name || "unknown"} — delay ${delaySeconds}s`);
    }

    // 4. Update cursor
    const newOffset = offset + batch.length;
    await updateFaqCursor(newOffset, false);

    // 5. Chain next orchestrator batch (with delay to let children finish)
    const totalDelayS = batch.length * DELAY_BETWEEN_CHILDREN_S + 60; // children + buffer
    logger.info(`Triggering next orchestrator batch in ${totalDelayS}s`);
    await extractFaqFromCrisp.trigger(undefined, { delay: `${totalDelayS}s` });

    // 6. Expose metadata
    try {
      metadata.set("offset", newOffset);
      metadata.set("triggered", batch.length);
      metadata.set("nextBatchDelay", `${totalDelayS}s`);
      await metadata.flush();
    } catch {
      // metadata may not be available
    }

    return {
      offset: newOffset,
      triggered: batch.length,
      children: triggered,
      nextBatchIn: `${totalDelayS}s`,
    };
  },
});

// ============================================
// HELPERS
// ============================================

interface Message {
  direction: string;
  content: string;
  content_type: string;
  sender_name: string | null;
  crisp_timestamp: string;
}

function buildTranscript(messages: Message[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    const time = new Date(msg.crisp_timestamp).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const sender = msg.sender_name || (msg.direction === "INBOUND" ? "Client" : "Support");

    if (msg.content_type === "note") {
      lines.push(`[${time}] [NOTE INTERNE] ${sender}: ${msg.content}`);
    } else if (msg.content_type === "file") {
      let fileName = "fichier";
      try {
        const parsed = JSON.parse(msg.content);
        fileName = parsed.name || parsed.url || "fichier";
      } catch {
        fileName = msg.content || "fichier";
      }
      lines.push(`[${time}] [FICHIER: ${fileName}] ${sender}`);
    } else if (msg.content_type === "event") {
      continue;
    } else {
      const prefix = msg.direction === "INBOUND" ? "[CLIENT]" : "[SUPPORT]";
      lines.push(`[${time}] ${prefix} ${sender}: ${msg.content}`);
    }
  }

  return lines.join("\n");
}

async function callClaude(
  client: Anthropic,
  convo: { contactName: string | null; firstMessageAt: string; lastMessageAt: string },
  transcript: string
): Promise<unknown[]> {
  const firstDate = new Date(convo.firstMessageAt).toLocaleDateString("fr-FR");
  const lastDate = new Date(convo.lastMessageAt).toLocaleDateString("fr-FR");

  const userPrompt = `Conversation support avec ${convo.contactName || "client inconnu"} — du ${firstDate} au ${lastDate}

${transcript}

Extrais les entrées FAQ en JSON :
[{
  "explicit_question": "...",
  "underlying_need": "...",
  "theme": "...",
  "product_terms": ["..."],
  "diagnostic_questions": ["..."],
  "resolution": "...",
  "resolution_type": "simple_answer|doc_gap|bug_fix|feature_request|config_help|investigation",
  "signal": "documentation_missing|feature_misunderstood|bug_report|ux_confusion|feature_request|onboarding_gap|ask_setting",
  "faq_score": 4,
  "faq_score_reason": "...",
  "complexity": "simple|investigation|bug|feature_request",
  "suggested_faq_title": "...",
  "suggested_faq_answer": "...",
  "file_references": ["..."]
}]`;

  const createMessage = async () => {
    // Use streaming to avoid SDK timeout on long Opus requests
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      logger.warn("Claude returned no text");
      return [];
    }

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) {
      logger.warn("Claude returned non-array JSON", { type: typeof parsed });
      return [];
    }

    return parsed;
  };

  try {
    return await createMessage();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Claude API error, retrying in 5s: ${msg}`);

    await new Promise((r) => setTimeout(r, 5000));

    // Retry once — let it throw if it fails again
    return await createMessage();
  }
}

async function sendFaqCompletionSlack(totalProcessed: number): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) return;

  const message = `📚 *[FAQ Extraction — Trigger.dev]* ✅ Terminé — ${new Date().toISOString().split("T")[0]}

📊 ${totalProcessed} conversations analysées
💡 Extractions FAQ prêtes dans Supabase \`tchat_faq_extractions\`

→ Prochaine étape : générer le doc FAQ Markdown`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    logger.error("Failed to send FAQ completion Slack", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
