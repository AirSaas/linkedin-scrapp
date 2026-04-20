import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sendErrorToScriptLogs, type TaskResultGroup } from "./lib/utils.js";
import {
  getAllFaqExtractions,
  getAllCirclePosts,
  getCompletedAuditUrls,
  insertAuditItem,
  getAuditItemsByRunId,
  insertFaqDocumentWithType,
  type FaqEntry,
  type CirclePostForAudit,
} from "./lib/crisp-supabase.js";
import { htmlToMarkdownWithImages, formatComments, callOpus } from "./lib/circle-audit-helpers.js";

// ============================================
// CONFIGURATION
// ============================================

const OPUS_MODEL = "claude-opus-4-20250514";
const MAX_TOKENS_PER_ARTICLE = 12000;
const MAX_TOKENS_NEW_ARTICLE = 8000;
const TEMPERATURE = 0.3;
const DEFAULT_MIN_SCORE = 3;

// ============================================
// PROMPTS
// ============================================

const ARTICLE_AUDIT_SYSTEM = `Tu es un expert en documentation produit pour AirSaas / PRC (SaaS B2B de gestion de projets).

Tu reçois :
1. Un article existant de la base de connaissances Circle (avec ses images marquées [IMAGE_N])
2. Les commentaires utilisateurs sur cet article
3. Les questions posées sur Crisp par des clients qui référencent cet article, avec les réponses données par l'équipe support

Ta mission : auditer l'article et produire une version améliorée.

FORMAT DE SORTIE (respecte exactement cette structure) :

### Diagnostic

Pour chaque point, utilise :
- ⚠️ **Incohérence** : quand l'article dit X mais le support répond Y
- ➕ **Manque** : info fréquemment demandée sur Crisp mais absente de l'article
- ✅ **OK** : section correcte et complète
- 🔄 **Outdated** : info qui semble ne plus correspondre au produit actuel

### Ce qui change
Liste bullet des modifications concrètes à appliquer.

### Article réécrit
L'article complet réécrit en markdown.
- Conserve TOUTES les images existantes [IMAGE_N] à leur position logique (ou repositionne-les si le texte autour change)
- Ne supprime JAMAIS une image existante
- Si du contenu nouveau mériterait une illustration, ajoute [NOUVELLE_IMAGE: description de ce qu'il faudrait capturer]
- Garde le ton et le style de l'article original
- Intègre les informations manquantes identifiées dans le diagnostic
- Corrige les incohérences

RÈGLES :
- Jamais de nom de client ou d'entreprise cliente
- Écris en français
- Sois factuel et actionnable`;

const NEW_ARTICLE_SYSTEM = `Tu es un expert en documentation produit pour AirSaas / PRC (SaaS B2B de gestion de projets).

Tu reçois un ensemble de questions fréquemment posées sur Crisp par des clients, avec les réponses données par l'équipe support. Ces questions n'ont AUCUN article correspondant dans la base de connaissances Circle.

Ta mission : rédiger un nouvel article complet pour la base de connaissances.

FORMAT DE SORTIE :

### Titre suggéré
Le titre de l'article (court, clair, avec emoji si pertinent)

### Espace recommandé
Où publier : "ca-vient-de-sortir" (si lié à une fonctionnalité), "debuter-sur-airsaas" (si guide/onboarding), ou "utilisateurs-d-airsaas" (si FAQ communauté)

### Article
Le contenu complet en markdown :
- Introduction courte (1-2 phrases)
- Sections avec sous-titres
- Étapes numérotées si c'est un guide
- [NOUVELLE_IMAGE: description] pour chaque capture d'écran nécessaire
- Tips/astuces en encadré si pertinent

RÈGLES :
- Jamais de nom de client ou d'entreprise cliente
- Écris en français
- Sois factuel et actionnable
- Base-toi UNIQUEMENT sur les réponses Crisp fournies (pas d'invention)`;

// ============================================
// TASK
// ============================================

export const auditCircleDocumentation = task({
  id: "audit-circle-documentation",
  maxDuration: 7200, // 2h
  run: async (payload?: { minScore?: number; dryRun?: boolean }) => {
    const startTime = Date.now();
    const minScore = payload?.minScore ?? DEFAULT_MIN_SCORE;
    const dryRun = payload?.dryRun ?? false;
    const auditRunId = crypto.randomUUID();
    const errors: TaskResultGroup[] = [];

    logger.info(`=== START audit-circle-documentation (runId=${auditRunId}, minScore=${minScore}, dryRun=${dryRun}) ===`);

    try {
      // 1. Fetch all data
      const [allEntries, allPosts, alreadyDone] = await Promise.all([
        getAllFaqExtractions(minScore),
        getAllCirclePosts(),
        getCompletedAuditUrls(24),
      ]);

      logger.info(`Fetched ${allEntries.length} FAQ entries, ${allPosts.length} Circle posts, ${alreadyDone.size} already audited`);

      // 2. Build index: Circle URL → post + FAQ entries that cite it
      const postsByUrl = new Map<string, CirclePostForAudit>();
      for (const post of allPosts) {
        postsByUrl.set(post.url, post);
      }

      const faqByArticleUrl = new Map<string, FaqEntry[]>();
      const faqWithoutRef: FaqEntry[] = [];
      const referencedUrls = new Set<string>();

      for (const entry of allEntries) {
        const refs = (entry.circle_references || []).filter((r) => r?.url);
        if (refs.length > 0) {
          for (const ref of refs) {
            referencedUrls.add(ref.url);
            const list = faqByArticleUrl.get(ref.url) || [];
            list.push(entry);
            faqByArticleUrl.set(ref.url, list);
          }
        } else {
          faqWithoutRef.push(entry);
        }
      }

      // Identify 3 populations
      const referencedPosts = [...faqByArticleUrl.entries()]
        .filter(([url]) => postsByUrl.has(url))
        .map(([url, entries]) => ({ post: postsByUrl.get(url)!, entries }));

      const orphanPosts = allPosts.filter((p) => !referencedUrls.has(p.url));

      // Group FAQ without ref by theme
      const faqWithoutRefByTheme = new Map<string, FaqEntry[]>();
      for (const entry of faqWithoutRef) {
        const theme = entry.theme || "Autre";
        const list = faqWithoutRefByTheme.get(theme) || [];
        list.push(entry);
        faqWithoutRefByTheme.set(theme, list);
      }

      logger.info(`Populations: ${referencedPosts.length} articles to audit, ${faqWithoutRefByTheme.size} themes for new articles, ${orphanPosts.length} orphan articles`);

      if (dryRun) {
        return {
          dryRun: true,
          referencedArticles: referencedPosts.length,
          faqWithoutRef: faqWithoutRef.length,
          themesForNewArticles: faqWithoutRefByTheme.size,
          orphanArticles: orphanPosts.length,
          alreadyDone: alreadyDone.size,
        };
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // ============================================
      // AXE A: Audit referenced articles (1 Opus call per article)
      // ============================================
      let auditedCount = 0;
      let skippedCount = 0;

      for (let i = 0; i < referencedPosts.length; i++) {
        const { post, entries } = referencedPosts[i];

        // Resume support: skip if already done
        if (alreadyDone.has(post.url)) {
          skippedCount++;
          continue;
        }

        auditedCount++;
        logger.info(`[Axe A ${auditedCount}/${referencedPosts.length - skippedCount}] Auditing: "${post.name}" (${entries.length} FAQ refs)`);

        // Convert HTML to markdown with image placeholders
        const { markdown: articleMarkdown, imageMapping } = htmlToMarkdownWithImages(post.body_html);

        // Format comments
        const commentsText = formatComments(post.comments);

        // Format FAQ entries
        const faqText = entries.map((e) => {
          const parts = [`Q: ${e.suggested_faq_title || e.explicit_question}`];
          parts.push(`R: ${e.suggested_faq_answer}`);
          if (e.source_quotes?.length) {
            parts.push(`Citations Crisp: ${e.source_quotes.slice(0, 3).map((q) => `"${q}"`).join(" | ")}`);
          }
          return parts.join("\n");
        }).join("\n\n");

        const userPrompt = `## Article à auditer

**Titre :** ${post.name}
**URL :** ${post.url}
**Espace :** ${post.space_slug} (${post.space_name})
**Images :** ${Object.keys(imageMapping).length} existantes

### Contenu actuel
${articleMarkdown}

${commentsText ? `### Commentaires sur l'article (${post.comments_count})\n${commentsText}\n` : ""}
### Questions Crisp qui référencent cet article (${entries.length})
${faqText}`;

        const analysis = await callOpus(client, OPUS_MODEL, ARTICLE_AUDIT_SYSTEM, userPrompt, MAX_TOKENS_PER_ARTICLE, TEMPERATURE);

        if (analysis) {
          await insertAuditItem({
            audit_run_id: auditRunId,
            article_url: post.url,
            article_name: post.name,
            audit_type: "update_needed",
            analysis,
            image_mapping: imageMapping,
            status: "done",
          });
        } else {
          logger.error(`Failed to audit article: ${post.name}`);
          errors.push({
            label: post.name,
            inserted: 0,
            skipped: 0,
            errors: [{ type: "Opus", code: "AUDIT_FAIL", message: `Article audit failed: ${post.url}` }],
          });
        }
      }

      logger.info(`Axe A done: ${auditedCount} audited, ${skippedCount} skipped (already done)`);

      // ============================================
      // AXE B: New articles for FAQ without Circle refs
      // ============================================
      const sortedThemes = [...faqWithoutRefByTheme.entries()]
        .filter(([, entries]) => entries.length >= 3) // Only themes with 3+ entries
        .sort((a, b) => b[1].length - a[1].length);

      let newArticleCount = 0;

      for (const [theme, entries] of sortedThemes) {
        const themeKey = `new_article:${theme}`;
        if (alreadyDone.has(themeKey)) continue;

        newArticleCount++;
        logger.info(`[Axe B ${newArticleCount}/${sortedThemes.length}] New article for theme: "${theme}" (${entries.length} entries)`);

        const faqText = entries.map((e) => {
          const parts = [`Q: ${e.suggested_faq_title || e.explicit_question}`];
          parts.push(`R: ${e.suggested_faq_answer}`);
          if (e.source_quotes?.length) {
            parts.push(`Citations: ${e.source_quotes.slice(0, 2).map((q) => `"${q}"`).join(" | ")}`);
          }
          return parts.join("\n");
        }).join("\n\n");

        const userPrompt = `## Thème : "${theme}" — ${entries.length} questions sans article Circle

${faqText}`;

        const analysis = await callOpus(client, OPUS_MODEL, NEW_ARTICLE_SYSTEM, userPrompt, MAX_TOKENS_NEW_ARTICLE, TEMPERATURE);

        if (analysis) {
          await insertAuditItem({
            audit_run_id: auditRunId,
            article_url: `new_article:${theme}`,
            article_name: theme,
            audit_type: "new_article",
            analysis,
            image_mapping: null,
            status: "done",
          });
        } else {
          logger.error(`Failed to generate new article for theme: ${theme}`);
          errors.push({
            label: theme,
            inserted: 0,
            skipped: 0,
            errors: [{ type: "Opus", code: "NEW_ARTICLE_FAIL", message: `New article generation failed: ${theme}` }],
          });
        }
      }

      logger.info(`Axe B done: ${newArticleCount} new articles generated`);

      // ============================================
      // AXE C: Orphan articles (no AI needed)
      // ============================================
      for (const post of orphanPosts) {
        await insertAuditItem({
          audit_run_id: auditRunId,
          article_url: post.url,
          article_name: post.name,
          audit_type: "orphan",
          analysis: `Article jamais référencé dans les conversations support Crisp.\nEspace: ${post.space_slug}\nPublié: ${post.published_at?.slice(0, 10)}\nCommentaires: ${post.comments_count}`,
          image_mapping: null,
          status: "done",
        });
      }

      logger.info(`Axe C done: ${orphanPosts.length} orphan articles logged`);

      // ============================================
      // ASSEMBLE FINAL REPORT
      // ============================================
      const allItems = await getAuditItemsByRunId(auditRunId);

      const updateItems = allItems.filter((i) => i.audit_type === "update_needed");
      const newItems = allItems.filter((i) => i.audit_type === "new_article");
      const orphanItems = allItems.filter((i) => i.audit_type === "orphan");

      const today = new Date().toISOString().split("T")[0];
      let markdown = `# Audit Documentation Circle — AirSaas / PRC\n\n`;
      markdown += `> Audit généré le ${today}\n`;
      markdown += `> ${allEntries.length} questions FAQ analysées, ${allPosts.length} articles Circle audités\n\n`;

      // TOC
      markdown += `## Table des matières\n\n`;
      markdown += `1. [Articles à mettre à jour](#articles-a-mettre-a-jour) (${updateItems.length})\n`;
      markdown += `2. [Nouveaux articles à créer](#nouveaux-articles-a-creer) (${newItems.length})\n`;
      markdown += `3. [Articles orphelins](#articles-orphelins) (${orphanItems.length})\n\n`;
      markdown += `---\n\n`;

      // Section 1: Articles to update
      markdown += `## Articles à mettre à jour\n\n`;
      markdown += `> ${updateItems.length} articles existants nécessitent une mise à jour basée sur les retours support Crisp.\n\n`;

      for (const item of updateItems) {
        markdown += `### 📝 ${item.article_name}\n\n`;
        markdown += `**URL :** ${item.article_url}\n`;
        if (item.image_mapping && Object.keys(item.image_mapping).length > 0) {
          markdown += `**Images :** ${Object.keys(item.image_mapping).length} existantes\n\n`;
          markdown += `<details>\n<summary>Mapping images</summary>\n\n`;
          for (const [placeholder, url] of Object.entries(item.image_mapping)) {
            markdown += `- ${placeholder} → ${url}\n`;
          }
          markdown += `\n</details>\n\n`;
        }
        markdown += `${item.analysis}\n\n---\n\n`;
      }

      // Section 2: New articles
      markdown += `## Nouveaux articles à créer\n\n`;
      markdown += `> ${newItems.length} nouveaux articles suggérés pour couvrir les questions sans documentation.\n\n`;

      for (const item of newItems) {
        markdown += `### 🆕 ${item.article_name}\n\n`;
        markdown += `${item.analysis}\n\n---\n\n`;
      }

      // Section 3: Orphans
      markdown += `## Articles orphelins\n\n`;
      markdown += `> ${orphanItems.length} articles qui ne sont référencés dans aucune conversation support Crisp.\n`;
      markdown += `> Ces articles sont potentiellement obsolètes ou couvrent des sujets rarement questionnés.\n\n`;

      for (const item of orphanItems) {
        markdown += `- **${item.article_name}** — ${item.article_url}\n`;
        markdown += `  ${item.analysis?.split("\n").slice(1).join(" | ") || ""}\n`;
      }

      logger.info(`Report assembled: ${markdown.length} chars`);

      // Save to Supabase
      const stats = {
        total_faq_entries: allEntries.length,
        total_circle_posts: allPosts.length,
        articles_audited: updateItems.length,
        new_articles_suggested: newItems.length,
        orphan_articles: orphanItems.length,
      };
      const docMetadata = {
        audit_run_id: auditRunId,
        generation_duration_ms: Date.now() - startTime,
        resumed_items: skippedCount,
      };

      const version = await insertFaqDocumentWithType(markdown, OPUS_MODEL, stats, docMetadata, "doc_audit");
      logger.info(`Saved audit report v${version} to Supabase`);

      // Slack notification
      await sendSuccessSlack(version, stats, docMetadata);

      // Report errors
      if (errors.length > 0) {
        await sendErrorToScriptLogs("Audit Circle Documentation", errors);
      }

      try {
        metadata.set("version", version);
        metadata.set("articlesAudited", updateItems.length);
        metadata.set("newArticles", newItems.length);
        metadata.set("orphans", orphanItems.length);
        await metadata.flush();
      } catch {
        // metadata may not be available
      }

      return {
        version,
        articlesAudited: updateItems.length,
        newArticlesSuggested: newItems.length,
        orphanArticles: orphanItems.length,
        durationMs: Date.now() - startTime,
        errors: errors.length,
        resumedItems: skippedCount,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Fatal error: ${msg}`);
      await sendErrorToScriptLogs("Audit Circle Documentation", [
        { label: "Fatal", inserted: 0, skipped: 0, errors: [{ type: "Fatal", code: "UNHANDLED", message: msg }] },
      ]);
      throw err;
    }
  },
});

async function sendSuccessSlack(
  version: number,
  stats: Record<string, unknown>,
  docMetadata: Record<string, unknown>
): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) return;

  const durationMin = Math.round((docMetadata.generation_duration_ms as number) / 60000);
  const message = `📋 *[Audit Circle Documentation — Trigger.dev]* ✅ v${version} — ${new Date().toISOString().split("T")[0]}

📊 Résultats
• Articles audités: ${stats.articles_audited}
• Nouveaux articles suggérés: ${stats.new_articles_suggested}
• Articles orphelins: ${stats.orphan_articles}
• Durée: ${durationMin}min

💾 Rapport sauvegardé dans \`tchat_faq_documents\` (type=doc_audit, v${version})`;

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
