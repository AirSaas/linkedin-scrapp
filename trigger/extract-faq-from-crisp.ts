import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sleep, sendErrorToScriptLogs, type TaskError, type TaskResultGroup } from "./lib/utils.js";
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
const SLEEP_BETWEEN_CONVERSATIONS_MS = 30_000;
const MODEL = "claude-opus-4-20250514";
const MAX_TOKENS = 4000;
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
// TASK
// ============================================

export const extractFaqFromCrisp = task({
  id: "extract-faq-from-crisp",
  maxDuration: 600, // 10 min max per batch
  run: async () => {
    logger.info("=== START extract-faq-from-crisp ===");

    // 1. Read cursor
    const cursor = await getFaqCursor();
    if (cursor.isDone) {
      logger.info("FAQ extraction already done, skipping");
      return { skipped: true, reason: "done" };
    }

    const offset = cursor.lastProcessedOffset;
    logger.info(`Starting from offset ${offset}`);

    // 2. Fetch conversations (fetch more than BATCH_SIZE to account for filtering)
    const conversations = await getConversationsForFaq(offset, BATCH_SIZE + 10);

    if (conversations.length === 0) {
      logger.info("No more conversations to process, marking done");
      await updateFaqCursor(offset, true);
      await sendFaqCompletionSlack(offset);
      return { done: true, totalProcessed: offset };
    }

    const batch = conversations.slice(0, BATCH_SIZE);
    logger.info(`Processing ${batch.length} conversations (offset ${offset})`);

    // 3. Process each conversation
    const errors: TaskError[] = [];
    let processed = 0;
    let extracted = 0;

    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    for (const convo of batch) {
      const label = `${convo.contact_name || "unknown"} (${convo.session_id.slice(0, 12)}...)`;

      try {
        // Fetch all messages
        const messages = await getMessagesForConversation(convo.session_id);
        if (messages.length < 3) {
          logger.info(`Skipping ${label}: only ${messages.length} messages`);
          processed++;
          continue;
        }

        // Build transcript
        const transcript = buildTranscript(messages);

        // Call Claude
        const extractions = await callClaude(client, convo, transcript);

        // Save
        await upsertFaqExtraction(
          convo.session_id,
          convo.contact_name,
          convo.first_message_at,
          extractions,
          MODEL
        );

        const faqCount = extractions.filter((e) => ((e as Record<string, unknown>).faq_score as number ?? 0) >= 3).length;
        logger.info(`${label}: ${extractions.length} entries extracted (${faqCount} with score >= 3)`);
        processed++;
        extracted += extractions.length;

        // Sleep between conversations (except last one)
        if (batch.indexOf(convo) < batch.length - 1) {
          await sleep(SLEEP_BETWEEN_CONVERSATIONS_MS);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Error processing ${label}: ${msg}`);
        errors.push({
          type: "FAQ Extraction",
          code: "exception",
          message: `${label}: ${msg}`,
        });
        processed++;
      }
    }

    // 4. Update cursor
    const newOffset = offset + batch.length;
    await updateFaqCursor(newOffset, false, conversations.length < BATCH_SIZE ? newOffset : undefined);

    // 5. Report errors
    if (errors.length > 0) {
      const groups: TaskResultGroup[] = [
        {
          label: "FAQ Extraction",
          inserted: extracted,
          skipped: processed - extracted,
          errors,
        },
      ];
      await sendErrorToScriptLogs("Extract FAQ from Crisp", groups);
    }

    // 6. Expose metadata
    try {
      if (errors.length > 0) {
        metadata.set("errorCount", errors.length);
        metadata.set(
          "errors",
          errors.map((e) => ({
            type: e.type,
            code: e.code,
            message: e.message.substring(0, 200),
          }))
        );
      }
      metadata.set("processed", processed);
      metadata.set("extracted", extracted);
      metadata.set("offset", newOffset);
      await metadata.flush();
    } catch {
      // metadata may not be available
    }

    logger.info(`Batch done: ${processed} processed, ${extracted} FAQ entries, ${errors.length} errors. New offset: ${newOffset}`);

    // 7. Chain next batch
    logger.info("Triggering next batch...");
    await extractFaqFromCrisp.trigger();

    return {
      processed,
      extracted,
      errors: errors.length,
      newOffset,
      chainedNext: true,
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
      // File messages: content is often JSON with URL/name
      let fileName = "fichier";
      try {
        const parsed = JSON.parse(msg.content);
        fileName = parsed.name || parsed.url || "fichier";
      } catch {
        fileName = msg.content || "fichier";
      }
      lines.push(`[${time}] [FICHIER: ${fileName}] ${sender}`);
    } else if (msg.content_type === "event") {
      // Skip system events
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
  convo: { contact_name: string | null; first_message_at: string; last_message_at: string },
  transcript: string
): Promise<unknown[]> {
  const firstDate = new Date(convo.first_message_at).toLocaleDateString("fr-FR");
  const lastDate = new Date(convo.last_message_at).toLocaleDateString("fr-FR");

  const userPrompt = `Conversation support avec ${convo.contact_name || "client inconnu"} — du ${firstDate} au ${lastDate}

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

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      logger.warn("Claude returned no text");
      return [];
    }

    // Parse JSON — handle potential markdown wrapping
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Retry once after 2s
    logger.warn(`Claude API error, retrying in 2s: ${msg}`);
    await sleep(2000);

    try {
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") return [];

      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(jsonText);
      return Array.isArray(parsed) ? parsed : [];
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      throw new Error(`Claude API failed after retry: ${retryMsg}`);
    }
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
