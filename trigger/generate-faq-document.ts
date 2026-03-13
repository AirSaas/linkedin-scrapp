import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sendErrorToScriptLogs, type TaskResultGroup } from "./lib/utils.js";
import { getAllFaqExtractions, insertFaqDocument, type FaqEntry } from "./lib/crisp-supabase.js";

// ============================================
// CONFIGURATION
// ============================================

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_PER_THEME = 8000;
const TEMPERATURE = 0.3;
const DEFAULT_MIN_SCORE = 3;

// ============================================
// THEME NORMALIZATION MAP
// ============================================

// Programmatic grouping: map raw themes to canonical themes
// This avoids expensive AI calls for theme consolidation
const THEME_ALIASES: Record<string, string> = {
  // Utilisateurs & licences
  "gestion des utilisateurs": "Gestion des utilisateurs et licences",
  "gestion des utilisateurs et licences": "Gestion des utilisateurs et licences",
  "gestion des comptes utilisateurs": "Gestion des utilisateurs et licences",
  "gestion des licences": "Gestion des utilisateurs et licences",
  "utilisateurs et droits": "Gestion des utilisateurs et licences",
  "comptes utilisateurs": "Gestion des utilisateurs et licences",
  // Droits & permissions
  "droits et permissions": "Droits et permissions",
  "permissions et rôles": "Droits et permissions",
  "gestion des droits et permissions": "Droits et permissions",
  "partage et permissions": "Droits et permissions",
  "rôles et permissions": "Droits et permissions",
  // Vues & filtres
  "filtrage et vues": "Vues et filtres",
  "vues et filtres": "Vues et filtres",
  "affichage et vues": "Vues et filtres",
  "navigation et vues": "Vues et filtres",
  "gestion des vues": "Vues et filtres",
  "vues et filtres portfolio": "Vues et filtres",
  "affichage des données dans les vues": "Vues et filtres",
  "smart views": "Vues et filtres",
  "vues intelligentes": "Vues et filtres",
  "filtres et smart views": "Vues et filtres",
  // Quarter planning
  "quarter plan": "Quarter Plan",
  "quarter planning": "Quarter Plan",
  "planification trimestrielle": "Quarter Plan",
  // IA
  "fonctionnalités ia": "Intelligence Artificielle",
  "intelligence artificielle": "Intelligence Artificielle",
  "ia et automatisation": "Intelligence Artificielle",
  // Configuration
  "configuration et personnalisation": "Configuration et personnalisation",
  "configuration et paramétrage": "Configuration et personnalisation",
  "personnalisation et configuration": "Configuration et personnalisation",
  "paramétrage": "Configuration et personnalisation",
  // Intégrations
  "intégrations": "Intégrations",
  "intégrations externes": "Intégrations",
  "intégrations tierces": "Intégrations",
  // Budget
  "gestion budgétaire": "Budget et coûts",
  "budget": "Budget et coûts",
  "budgets et coûts": "Budget et coûts",
  // Équipes
  "gestion des équipes": "Gestion des équipes",
  "organisation des équipes": "Gestion des équipes",
  // Authentification
  "authentification et accès": "Authentification et sécurité",
  "authentification et sécurité": "Authentification et sécurité",
  // Partage
  "partage et collaboration": "Partage et collaboration",
  "flash reports et partage": "Partage et collaboration",
  // Export
  "export et présentation": "Export et données",
  "export et analyse de données": "Export et données",
  "import de données": "Export et données",
  // Capacité
  "capacité et planification": "Capacité et ressources",
  "capacité et ressources": "Capacité et ressources",
  // Notifications
  "notifications et communication": "Notifications",
  "notifications": "Notifications",
  // Navigation
  "navigation et interface": "Navigation et interface",
  // Modules
  "modules et fonctionnalités": "Activation de fonctionnalités",
  "activation de fonctionnalités": "Activation de fonctionnalités",
};

function normalizeTheme(rawTheme: string): string {
  const key = rawTheme.toLowerCase().trim();
  return THEME_ALIASES[key] || rawTheme; // Keep original if no alias
}

// ============================================
// PROMPT (per theme group — dedup + markdown)
// ============================================

const THEME_SYSTEM_PROMPT = `Tu es un rédacteur technique expert pour la FAQ produit AirSaas / PRC (SaaS B2B de gestion de projets).

Tu reçois un groupe d'entrées FAQ sur un même thème, extraites de conversations support Crisp.

Ta mission en 2 étapes :

1. DÉDUPLIQUER — Identifie les entrées qui posent la MÊME question (même besoin sous-jacent) :
   - Fusionne-les en UNE seule entrée
   - Garde la meilleure réponse (la plus complète et claire)
   - Merge les source_quotes (garde les plus pertinentes, max 3 par question)
   - Merge les circle_references (déduplique par URL)
   - Supprime les entrées trop spécifiques ou qui décrivent un bug

2. GÉNÉRER LE MARKDOWN de cette section :
   - Chaque question en H3 (###), classée par pertinence
   - Réponse claire et actionnable en français
   - Bloc <details><summary>Sources</summary> avec les citations verbatim </details>
   - Liens vers les articles Circle pertinents après la réponse
   - Formatage : "- " pour bullet points, "1. " pour listes numérotées, **Gras** pour sous-titres

RÈGLES :
- Jamais de nom de client ou d'entreprise cliente
- Réponses autonomes et lisibles
- Écris en français
- Réponds UNIQUEMENT avec le Markdown de cette section (pas de titre H2, juste les H3 et leur contenu)`;

// ============================================
// TASK
// ============================================

export const generateFaqDocument = task({
  id: "generate-faq-document",
  maxDuration: 1800, // 30 min
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

      // 2. Group by normalized theme (programmatic — no AI needed)
      const themeGroups = new Map<string, FaqEntry[]>();
      for (const entry of allEntries) {
        const canonical = normalizeTheme(entry.theme || "Autre");
        const group = themeGroups.get(canonical) || [];
        group.push(entry);
        themeGroups.set(canonical, group);
      }

      // Sort themes by entry count descending
      const sortedThemes = [...themeGroups.entries()]
        .sort((a, b) => b[1].length - a[1].length);

      logger.info(`Grouped into ${sortedThemes.length} themes (from ${allEntries.length} entries)`);
      for (const [theme, entries] of sortedThemes.slice(0, 10)) {
        logger.info(`  ${theme}: ${entries.length} entries`);
      }

      if (dryRun) {
        logger.info("Dry run — skipping Claude calls and save");
        return {
          dryRun: true,
          entriesTotal: allEntries.length,
          themeCount: sortedThemes.length,
          themes: sortedThemes.map(([t, e]) => ({ theme: t, count: e.length })),
        };
      }

      // 3. Process theme groups
      // Themes with <=2 entries: format directly in code (no AI needed)
      // Themes with 3+ entries: one Sonnet call for dedup + markdown
      const AI_THRESHOLD = 3; // Only call Claude for themes with 3+ entries
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const sections: Array<{ theme: string; markdown: string; entryCount: number }> = [];
      let totalEntriesAfterDedup = 0;
      let aiCallCount = 0;

      for (let i = 0; i < sortedThemes.length; i++) {
        const [theme, entries] = sortedThemes[i];

        if (entries.length < AI_THRESHOLD) {
          // Format directly — no Claude call needed
          const sectionMd = formatEntriesDirectly(entries);
          totalEntriesAfterDedup += entries.length;
          sections.push({ theme, markdown: sectionMd, entryCount: entries.length });
          continue;
        }

        aiCallCount++;
        logger.info(`Processing theme ${aiCallCount} (${i + 1}/${sortedThemes.length}): "${theme}" (${entries.length} entries)`);

        // Compact JSON — no pretty-printing to save tokens
        const compact = entries.map((e) => ({
          t: e.suggested_faq_title,
          a: e.suggested_faq_answer,
          n: e.underlying_need,
          s: e.faq_score,
          sq: (e.source_quotes || []).slice(0, 3),
          cr: (e.circle_references || []).slice(0, 3),
        }));

        const userPrompt = `Thème : "${theme}" — ${entries.length} entrées FAQ

Légende JSON : t=titre, a=réponse, n=besoin sous-jacent, s=score, sq=citations source, cr=références Circle

${JSON.stringify(compact)}`;

        const sectionMd = await callClaudeText(client, THEME_SYSTEM_PROMPT, userPrompt, MAX_TOKENS_PER_THEME);

        if (sectionMd) {
          const questionCount = (sectionMd.match(/^### /gm) || []).length;
          totalEntriesAfterDedup += questionCount;
          sections.push({ theme, markdown: sectionMd, entryCount: questionCount });
          logger.info(`  → ${entries.length} entries → ${questionCount} questions`);
        } else {
          logger.error(`  → Failed for theme "${theme}", falling back to direct format`);
          const fallbackMd = formatEntriesDirectly(entries);
          totalEntriesAfterDedup += entries.length;
          sections.push({ theme, markdown: fallbackMd, entryCount: entries.length });
          errors.push({
            label: theme,
            inserted: 0,
            skipped: entries.length,
            errors: [{ type: "Claude", code: "THEME_FAIL", message: `Theme "${theme}" generation failed` }],
          });
        }
      }

      logger.info(`Processed ${sortedThemes.length} themes (${aiCallCount} AI calls, ${sortedThemes.length - aiCallCount} direct format)`);

      // 4. Assemble final document
      const today = new Date().toISOString().split("T")[0];
      const themeCount = sections.length;

      let markdown = `# FAQ Produit AirSaas / PRC\n\n`;
      markdown += `> Document généré automatiquement le ${today} à partir de ${allEntries.length} entrées FAQ extraites de conversations support Crisp.\n`;
      markdown += `> ${totalEntriesAfterDedup} questions uniques identifiées, regroupées en ${themeCount} thèmes.\n\n`;

      // Table of contents
      markdown += `## Table des matières\n\n`;
      for (let i = 0; i < sections.length; i++) {
        const slug = sections[i].theme
          .toLowerCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        markdown += `${i + 1}. [${sections[i].theme}](#${slug}) (${sections[i].entryCount})\n`;
      }
      markdown += `\n---\n\n`;

      // Theme sections
      for (const section of sections) {
        markdown += `## ${section.theme}\n\n`;
        markdown += section.markdown;
        markdown += `\n\n---\n\n`;
      }

      logger.info(`Document assembled: ${markdown.length} chars, ${themeCount} themes, ${totalEntriesAfterDedup} questions`);

      // 5. Save to Supabase
      const stats = {
        total_entries_before: allEntries.length,
        total_entries_after: totalEntriesAfterDedup,
        total_themes: themeCount,
        min_score: minScore,
      };
      const docMetadata = {
        batch_count: sortedThemes.length,
        generation_duration_ms: Date.now() - startTime,
      };

      const version = await insertFaqDocument(markdown, MODEL, stats, docMetadata);
      logger.info(`Saved FAQ document v${version} to Supabase`);

      // 6. Slack notification
      await sendSuccessSlack(version, stats, docMetadata);

      // 7. Report errors
      if (errors.length > 0) {
        await sendErrorToScriptLogs("Generate FAQ Document", errors);
      }

      try {
        metadata.set("version", version);
        metadata.set("entriesBefore", allEntries.length);
        metadata.set("entriesAfter", totalEntriesAfterDedup);
        metadata.set("themes", themeCount);
        metadata.set("markdownLength", markdown.length);
        await metadata.flush();
      } catch {
        // metadata may not be available
      }

      return {
        version,
        entriesBefore: allEntries.length,
        entriesAfter: totalEntriesAfterDedup,
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

function formatEntriesDirectly(entries: FaqEntry[]): string {
  const lines: string[] = [];
  for (const e of entries) {
    lines.push(`### ${e.suggested_faq_title || "Question"}\n`);
    lines.push(`${e.suggested_faq_answer || ""}\n`);

    const quotes = (e.source_quotes || []).filter(Boolean);
    const refs = (e.circle_references || []).filter((r) => r?.url);

    if (quotes.length > 0 || refs.length > 0) {
      lines.push(`<details>\n<summary>Sources</summary>\n`);
      for (const q of quotes) {
        lines.push(`> "${q}"\n`);
      }
      if (refs.length > 0) {
        lines.push(`\n**Références Circle :**`);
        for (const r of refs) {
          lines.push(`- [${r.title}](${r.url})`);
        }
      }
      lines.push(`\n</details>\n`);
    }
  }
  return lines.join("\n");
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
    logger.warn(`Claude call failed, retrying in 5s: ${msg}`);
    await new Promise((r) => setTimeout(r, 5000));
    try {
      return await callOnce();
    } catch (retryErr) {
      logger.error(`Claude call failed after retry: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`);
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
