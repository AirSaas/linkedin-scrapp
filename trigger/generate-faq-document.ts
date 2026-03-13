import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sendErrorToScriptLogs, type TaskResultGroup } from "./lib/utils.js";
import { getAllFaqExtractions, insertFaqDocument, type FaqEntry } from "./lib/crisp-supabase.js";

// ============================================
// CONFIGURATION
// ============================================

const MODEL = "claude-opus-4-20250514";
const MAX_TOKENS_PHASE1 = 16000;
const MAX_TOKENS_PHASE2 = 32000;
const TEMPERATURE = 0.3;
const BATCH_SIZE = 100;
const DEFAULT_MIN_SCORE = 3;

// ============================================
// PROMPTS
// ============================================

const PHASE1_SYSTEM_PROMPT = `Tu es un expert en consolidation de FAQ produit SaaS B2B (AirSaas / PRC).

Tu reçois un batch d'entrées FAQ extraites de conversations support Crisp. Chaque entrée a un thème, une question, une réponse suggérée, des citations source et des références Circle.

Ta mission en 3 étapes :

1. NORMALISER LES THÈMES — Beaucoup de thèmes sont des variantes du même sujet :
   - "Gestion des utilisateurs" + "Gestion des utilisateurs et licences" + "Utilisateurs et droits" → un seul canonical_theme "Gestion des utilisateurs et licences"
   - "Smart Views" + "Vues intelligentes" + "Filtres et Smart Views" → "Smart Views et filtres"
   - Choisis le nom le plus clair et complet pour chaque thème canonique

2. DÉDUPLIQUER — Identifie les entrées qui posent la MÊME question (même besoin sous-jacent) :
   - Fusionne-les en UNE seule entrée
   - Garde la meilleure suggested_faq_answer (la plus complète et claire)
   - Merge les source_quotes (garde les plus pertinentes, max 5)
   - Merge les circle_references (déduplique par URL)
   - Garde le faq_score le plus élevé

3. NETTOYER — Supprime les entrées :
   - Trop spécifiques à un client malgré score >= 3
   - Redondantes avec une autre entrée mieux formulée
   - Qui décrivent un bug plutôt qu'une question FAQ

Réponds UNIQUEMENT en JSON valide, un tableau d'objets. Chaque objet DOIT avoir ces champs :
- canonical_theme (string)
- suggested_faq_title (string)
- suggested_faq_answer (string, markdown formaté)
- faq_score (number)
- signal (string)
- source_quotes (string[])
- circle_references ({title: string, url: string}[])
- underlying_need (string)
- merged_count (number — combien d'entrées originales ont été fusionnées, 1 si pas de fusion)

Pas de markdown, pas de backticks, pas de commentaires autour du JSON.`;

const PHASE2_SYSTEM_PROMPT = `Tu es un rédacteur technique expert pour la FAQ produit AirSaas / PRC (SaaS B2B de gestion de projets).

Tu reçois un ensemble consolidé d'entrées FAQ, déjà dédupliquées et groupées par thème. Génère un document Markdown structuré et professionnel.

STRUCTURE DU DOCUMENT :
1. Titre H1 + paragraphe d'introduction avec date et stats
2. Table des matières avec liens internes vers chaque thème
3. Pour chaque thème (H2), classé par nombre de questions décroissant :
   - Pour chaque question (H3), classée par faq_score décroissant :
     - Réponse claire et actionnable en français
     - Bloc <details> "Sources" avec les citations verbatim
     - Liens vers les articles Circle pertinents

RÈGLES DE FORMATAGE :
- Bullet points : "- " (tiret espace), sous-niveaux avec 2 espaces d'indentation
- Listes numérotées : "1. " avec indentation cohérente
- Ne jamais mixer bullet points et numéros dans la même liste
- Sous-titres en **Gras** quand nécessaire dans les réponses
- Ancres de la table des matières : slugifiées en minuscules, tirets pour les espaces
- Les citations source dans <details><summary>Sources</summary>...</details>
- Les références Circle comme liens markdown après la réponse

IMPORTANT :
- Jamais de nom de client ou d'entreprise cliente
- Le document doit être autonome et lisible
- Écris en français
- Réponds UNIQUEMENT avec le Markdown du document, rien d'autre`;

// ============================================
// TASK
// ============================================

export const generateFaqDocument = task({
  id: "generate-faq-document",
  maxDuration: 600,
  run: async (payload: { minScore?: number; dryRun?: boolean }) => {
    const startTime = Date.now();
    const minScore = payload.minScore ?? DEFAULT_MIN_SCORE;
    const dryRun = payload.dryRun ?? false;
    const errors: TaskResultGroup[] = [];

    logger.info(`=== START generate-faq-document (minScore=${minScore}, dryRun=${dryRun}) ===`);

    try {
      // 1. Fetch all FAQ extractions
      const allEntries = await getAllFaqExtractions(minScore);
      logger.info(`Fetched ${allEntries.length} FAQ entries with score >= ${minScore}`);

      if (allEntries.length === 0) {
        logger.info("No entries found, exiting");
        return { skipped: true, reason: "no_entries" };
      }

      // 2. Split into batches
      const batches: FaqEntry[][] = [];
      for (let i = 0; i < allEntries.length; i += BATCH_SIZE) {
        batches.push(allEntries.slice(i, i + BATCH_SIZE));
      }
      logger.info(`Split into ${batches.length} batches of ~${BATCH_SIZE}`);

      // 3. Phase 1: Consolidation + dedup per batch
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const consolidatedAll: unknown[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.info(`Phase 1 — batch ${i + 1}/${batches.length} (${batch.length} entries)`);

        const stripped = batch.map((e) => ({
          theme: e.theme,
          suggested_faq_title: e.suggested_faq_title,
          suggested_faq_answer: e.suggested_faq_answer,
          underlying_need: e.underlying_need,
          faq_score: e.faq_score,
          signal: e.signal,
          source_quotes: e.source_quotes || [],
          circle_references: e.circle_references || [],
        }));

        const result = await callClaudeJson(
          client,
          PHASE1_SYSTEM_PROMPT,
          `Voici ${batch.length} entrées FAQ à consolider :\n\n${JSON.stringify(stripped, null, 2)}`,
          MAX_TOKENS_PHASE1
        );

        if (result) {
          consolidatedAll.push(...result);
          logger.info(`Phase 1 batch ${i + 1}: ${batch.length} → ${result.length} entries`);
        } else {
          logger.error(`Phase 1 batch ${i + 1} failed — keeping raw entries`);
          consolidatedAll.push(...stripped);
          errors.push({
            label: `Phase 1 batch ${i + 1}`,
            inserted: 0,
            skipped: batch.length,
            errors: [{ type: "Claude", code: "PHASE1_FAIL", message: `Batch ${i + 1} consolidation failed` }],
          });
        }
      }

      logger.info(`Phase 1 complete: ${allEntries.length} → ${consolidatedAll.length} consolidated entries`);

      if (dryRun) {
        logger.info("Dry run — skipping Phase 2 and save");
        return {
          dryRun: true,
          entriesBefore: allEntries.length,
          entriesAfterPhase1: consolidatedAll.length,
          batches: batches.length,
        };
      }

      // 4. Phase 2: Markdown generation
      logger.info(`Phase 2 — generating Markdown from ${consolidatedAll.length} entries`);

      const today = new Date().toISOString().split("T")[0];
      const phase2Prompt = `Voici ${consolidatedAll.length} entrées FAQ consolidées et dédupliquées à transformer en document Markdown.

Date de génération : ${today}
Nombre d'entrées originales : ${allEntries.length}
Nombre après déduplication : ${consolidatedAll.length}

Entrées :
${JSON.stringify(consolidatedAll, null, 2)}`;

      const markdown = await callClaudeText(client, PHASE2_SYSTEM_PROMPT, phase2Prompt, MAX_TOKENS_PHASE2);

      if (!markdown) {
        logger.error("Phase 2 failed — no markdown generated");
        errors.push({
          label: "Phase 2 Markdown",
          inserted: 0,
          skipped: 0,
          errors: [{ type: "Claude", code: "PHASE2_FAIL", message: "Markdown generation failed" }],
        });
        await sendErrorToScriptLogs("Generate FAQ Document", errors);
        return { error: "phase2_failed", entriesConsolidated: consolidatedAll.length };
      }

      logger.info(`Phase 2 complete: ${markdown.length} chars`);

      // 5. Count themes in the markdown
      const themeCount = (markdown.match(/^## /gm) || []).length;

      // 6. Save to Supabase
      const stats = {
        total_entries_before: allEntries.length,
        total_entries_after: consolidatedAll.length,
        total_themes: themeCount,
        min_score: minScore,
      };
      const docMetadata = {
        batch_count: batches.length,
        generation_duration_ms: Date.now() - startTime,
      };

      const version = await insertFaqDocument(markdown, MODEL, stats, docMetadata);
      logger.info(`Saved FAQ document v${version} to Supabase`);

      // 7. Slack notification
      await sendSuccessSlack(version, stats, docMetadata);

      // 8. Report any Phase 1 errors
      if (errors.length > 0) {
        await sendErrorToScriptLogs("Generate FAQ Document", errors);
      }

      try {
        metadata.set("version", version);
        metadata.set("entriesBefore", allEntries.length);
        metadata.set("entriesAfter", consolidatedAll.length);
        metadata.set("themes", themeCount);
        metadata.set("markdownLength", markdown.length);
        await metadata.flush();
      } catch {
        // metadata may not be available
      }

      return {
        version,
        entriesBefore: allEntries.length,
        entriesAfter: consolidatedAll.length,
        themes: themeCount,
        markdownLength: markdown.length,
        durationMs: Date.now() - startTime,
        errors: errors.length,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Fatal error: ${msg}`);
      await sendErrorToScriptLogs("Generate FAQ Document", [
        { label: "Fatal", inserted: 0, skipped: 0, errors: [{ type: "Fatal", code: "UNHANDLED", message: msg }] },
      ]);
      throw err;
    }
  },
});

// ============================================
// HELPERS
// ============================================

async function callClaudeJson(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<unknown[] | null> {
  const callOnce = async () => {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    let jsonText = textBlock.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    if (!jsonText.startsWith("[")) {
      const first = jsonText.indexOf("[");
      const last = jsonText.lastIndexOf("]");
      if (first !== -1 && last > first) {
        jsonText = jsonText.slice(first, last + 1);
      }
    }

    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? parsed : null;
  };

  try {
    return await callOnce();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Claude JSON call failed, retrying in 5s: ${msg}`);
    await new Promise((r) => setTimeout(r, 5000));
    try {
      return await callOnce();
    } catch (retryErr) {
      logger.error(`Claude JSON call failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
      return null;
    }
  }
}

async function callClaudeText(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string | null> {
  const callOnce = async () => {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const message = await stream.finalMessage();
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    return textBlock.text.trim();
  };

  try {
    return await callOnce();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Claude text call failed, retrying in 5s: ${msg}`);
    await new Promise((r) => setTimeout(r, 5000));
    try {
      return await callOnce();
    } catch (retryErr) {
      logger.error(`Claude text call failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
      return null;
    }
  }
}

async function sendSuccessSlack(
  version: number,
  stats: Record<string, unknown>,
  docMetadata: Record<string, unknown>
): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) return;

  const durationSec = Math.round((docMetadata.generation_duration_ms as number) / 1000);
  const message = `📚 *[Generate FAQ Document — Trigger.dev]* ✅ v${version} — ${new Date().toISOString().split("T")[0]}

📊 Résultats
• Entrées initiales: ${stats.total_entries_before}
• Après déduplication: ${stats.total_entries_after}
• Thèmes: ${stats.total_themes}
• Durée: ${durationSec}s

💾 Document Markdown sauvegardé dans \`tchat_faq_documents\` (v${version})`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
  } catch (err) {
    logger.error("Failed to send success Slack", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
