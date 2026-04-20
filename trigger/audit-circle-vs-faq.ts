import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sendErrorToScriptLogs, type TaskResultGroup } from "./lib/utils.js";
import {
  getFaqApproved,
  getAllCirclePosts,
  getAuditItemsByRunId,
  insertAuditItem,
  insertFaqDocumentWithType,
  type CirclePostForAudit,
} from "./lib/crisp-supabase.js";
import { parseFaq, type ParsedFaq } from "./lib/faq-parser.js";
import {
  callOpus,
  formatComments,
  htmlToMarkdownWithImages,
} from "./lib/circle-audit-helpers.js";

// ============================================
// CONFIGURATION
// ============================================

const OPUS_MODEL = "claude-opus-4-20250514";
const MAX_TOKENS_PER_ARTICLE = 16000;
const MAX_TOKENS_NEW_ARTICLE = 10000;
const TEMPERATURE = 0.3;
const TOP_THEMES_PER_ARTICLE = 3;
const MIN_THEME_SCORE = 1;

// ============================================
// PROMPTS
// ============================================

const ARTICLE_AUDIT_SYSTEM = `Tu es un expert en documentation produit pour AirSaas / PRC (SaaS B2B de gestion de projets).

Tu reçois :
1. Un article existant de la base de connaissances Circle (avec ses images marquées [IMAGE_N])
2. Les sections de la FAQ officielle qui couvrent les mêmes sujets

La FAQ est la SOURCE DE VÉRITÉ. Si l'article dit quelque chose qui diffère de la FAQ, c'est l'article qui a tort.

Ta mission : auditer l'article par rapport à la FAQ et produire une version corrigée.

RÈGLES DE RÉÉCRITURE :
- Conserve TOUTES les images existantes [IMAGE_N] à leur position logique (ou repositionne-les si le texte autour change)
- Ne supprime JAMAIS une image existante
- Si un nouveau passage mériterait une illustration, ajoute [NOUVELLE_IMAGE: description]
- Garde le ton et le style de l'article original
- Intègre les informations manquantes identifiées via la FAQ
- Corrige les incohérences factuelles
- Pas de nom de client ou d'entreprise cliente
- Écris en français
- Sois factuel et actionnable

FORMAT DE SORTIE — JSON strict, pas de prose, pas de backticks :
{
  "summary_changes": [
    "Description concise du changement 1",
    "Description concise du changement 2",
    "..."
  ],
  "rewritten_article_md": "L'article complet réécrit en markdown, avec [IMAGE_N] à leur place."
}

Si après analyse l'article est parfaitement aligné avec la FAQ et qu'aucune modification n'est justifiée, réponds :
{
  "summary_changes": [],
  "rewritten_article_md": ""
}`;

const NEW_ARTICLE_SYSTEM = `Tu es un expert en documentation produit pour AirSaas / PRC (SaaS B2B de gestion de projets).

Tu reçois un thème de la FAQ officielle (avec toutes ses questions et réponses) qui n'a AUCUN article correspondant dans la base de connaissances Circle.

Ta mission : rédiger un brouillon complet d'un nouvel article Circle qui couvre ce thème.

RÈGLES :
- Titre clair et actionnable (court, avec emoji si pertinent)
- Choisis l'espace parmi : "ca-vient-de-sortir" (si lié à une fonctionnalité), "debuter-sur-airsaas" (si guide/onboarding), ou "utilisateurs-d-airsaas" (si FAQ communauté)
- Structure : introduction courte (1-2 phrases), sections avec sous-titres, étapes numérotées si guide
- Ajoute [NOUVELLE_IMAGE: description] pour chaque capture d'écran qu'il faudrait produire
- Pas de nom de client ou d'entreprise cliente
- Écris en français
- Base-toi UNIQUEMENT sur les Q/R FAQ fournies (pas d'invention)
- Ton communautaire de Circle (tutoriel, guide pratique)

FORMAT DE SORTIE — JSON strict, pas de prose, pas de backticks :
{
  "suggested_title": "...",
  "recommended_space": "ca-vient-de-sortir" | "debuter-sur-airsaas" | "utilisateurs-d-airsaas",
  "article_md": "Le contenu complet de l'article en markdown."
}`;

// ============================================
// TYPES
// ============================================

interface ArticleMapping {
  post: CirclePostForAudit;
  themes: string[]; // ordered by relevance (top first)
}

interface ArticleAuditOutput {
  summary_changes: string[];
  rewritten_article_md: string;
}

interface NewArticleOutput {
  suggested_title: string;
  recommended_space: string;
  article_md: string;
}

// ============================================
// TASK
// ============================================

export const auditCircleVsFaq = task({
  id: "audit-circle-vs-faq",
  maxDuration: 7200, // 2h
  run: async (payload?: { dryRun?: boolean }) => {
    const startTime = Date.now();
    const dryRun = payload?.dryRun ?? false;
    const auditRunId = crypto.randomUUID();
    const errors: TaskResultGroup[] = [];

    logger.info(`=== START audit-circle-vs-faq (runId=${auditRunId}, dryRun=${dryRun}) ===`);

    try {
      // ──────────────────────────────────────────
      // 1. Load FAQ + Circle posts
      // ──────────────────────────────────────────
      const [faqApproved, allPosts] = await Promise.all([
        getFaqApproved(),
        getAllCirclePosts(),
      ]);

      if (!faqApproved) {
        const msg = "No approved FAQ found in Supabase (type=faq_approved). Run scripts/upload-faq-approved.ts first.";
        logger.error(msg);
        await sendSlack(`❌ [audit-circle-vs-faq] ${msg}`);
        return { error: msg };
      }

      const faq = parseFaq(faqApproved.markdown);
      logger.info(
        `FAQ v${faqApproved.version}: ${faq.themes.length} themes, ${Object.keys(faq.sectionsByTitle).length} questions. Circle posts: ${allPosts.length} published.`
      );

      // ──────────────────────────────────────────
      // 2. Pre-mapping article → top FAQ themes
      // ──────────────────────────────────────────
      const mappings: ArticleMapping[] = allPosts.map((post) => ({
        post,
        themes: scoreArticleAgainstThemes(post, faq),
      }));

      const coveredArticles = mappings.filter((m) => m.themes.length > 0);
      const skippedArticles = mappings.filter((m) => m.themes.length === 0);

      const coveredThemes = new Set<string>();
      for (const m of coveredArticles) {
        for (const theme of m.themes) coveredThemes.add(theme);
      }
      const uncoveredThemes = faq.themes.filter((t) => !coveredThemes.has(t));

      logger.info(
        `Mappings: ${coveredArticles.length} articles covered, ${skippedArticles.length} skipped, ${uncoveredThemes.length}/${faq.themes.length} themes without article`
      );

      if (dryRun) {
        return {
          dryRun: true,
          faqVersion: faqApproved.version,
          totalArticles: allPosts.length,
          coveredArticles: coveredArticles.length,
          skippedArticles: skippedArticles.length,
          uncoveredThemes: uncoveredThemes.length,
          sampleMapping: coveredArticles.slice(0, 5).map((m) => ({
            article: m.post.name,
            themes: m.themes,
          })),
          sampleUncoveredThemes: uncoveredThemes.slice(0, 10),
        };
      }

      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // ──────────────────────────────────────────
      // 3. Partie A — audit covered articles
      // ──────────────────────────────────────────
      let auditedCount = 0;
      let noChangeCount = 0;

      for (let i = 0; i < coveredArticles.length; i++) {
        const { post, themes } = coveredArticles[i];
        auditedCount++;
        logger.info(
          `[Partie A ${auditedCount}/${coveredArticles.length}] "${post.name}" (themes: ${themes.join(", ")})`
        );

        const { markdown: articleMd, imageMapping } = htmlToMarkdownWithImages(post.body_html);
        const faqSections = buildFaqSectionsForThemes(themes, faq);
        const commentsText = formatComments(post.comments);

        const userPrompt = `## ARTICLE À AUDITER

**Titre :** ${post.name}
**URL :** ${post.url}
**Espace :** ${post.space_slug}
**Images existantes :** ${Object.keys(imageMapping).length}

### Contenu actuel
${articleMd}
${commentsText ? `\n### Commentaires sur l'article (${post.comments_count})\n${commentsText}\n` : ""}
---

## FAQ DE RÉFÉRENCE (source de vérité)

${faqSections}`;

        const raw = await callOpus(
          client,
          OPUS_MODEL,
          ARTICLE_AUDIT_SYSTEM,
          userPrompt,
          MAX_TOKENS_PER_ARTICLE,
          TEMPERATURE
        );

        if (!raw) {
          errors.push({
            label: post.name,
            inserted: 0,
            skipped: 0,
            errors: [{ type: "Opus", code: "AUDIT_FAIL", message: `Article audit failed: ${post.url}` }],
          });
          continue;
        }

        const parsed = tryParseJson<ArticleAuditOutput>(raw);
        if (!parsed) {
          errors.push({
            label: post.name,
            inserted: 0,
            skipped: 0,
            errors: [{ type: "Opus", code: "PARSE_FAIL", message: `Could not parse JSON for ${post.url}` }],
          });
          continue;
        }

        const hasChanges = parsed.summary_changes.length > 0 && parsed.rewritten_article_md.trim().length > 0;
        if (!hasChanges) {
          noChangeCount++;
        }

        await insertAuditItem({
          audit_run_id: auditRunId,
          article_url: post.url,
          article_name: post.name,
          audit_type: hasChanges ? "update_needed" : "no_change",
          analysis: JSON.stringify({
            themes_matched: themes,
            summary_changes: parsed.summary_changes,
            original_article_md: articleMd,
            rewritten_article_md: parsed.rewritten_article_md,
            space_slug: post.space_slug,
          }),
          image_mapping: imageMapping,
          status: "done",
        });
      }

      logger.info(`Partie A done: ${auditedCount} audited (${noChangeCount} no-change)`);

      // ──────────────────────────────────────────
      // 4. Partie B — new article drafts for uncovered themes
      // ──────────────────────────────────────────
      let newArticleCount = 0;

      for (const theme of uncoveredThemes) {
        const questions = faq.sectionsByTheme[theme] || [];
        if (questions.length === 0) continue;

        newArticleCount++;
        logger.info(
          `[Partie B ${newArticleCount}/${uncoveredThemes.length}] Theme without Circle article: "${theme}" (${questions.length} questions)`
        );

        const themeContent = questions
          .map((q) => {
            const section = faq.sectionsByTitle[q];
            return section ? section : `### ${q}\n(contenu manquant)`;
          })
          .join("\n\n");

        const userPrompt = `## THÈME FAQ SANS ARTICLE CIRCLE

**Thème :** ${theme}
**Nombre de questions :** ${questions.length}

### Contenu FAQ du thème
${themeContent}`;

        const raw = await callOpus(
          client,
          OPUS_MODEL,
          NEW_ARTICLE_SYSTEM,
          userPrompt,
          MAX_TOKENS_NEW_ARTICLE,
          TEMPERATURE
        );

        if (!raw) {
          errors.push({
            label: theme,
            inserted: 0,
            skipped: 0,
            errors: [{ type: "Opus", code: "NEW_ARTICLE_FAIL", message: `New article draft failed: ${theme}` }],
          });
          continue;
        }

        const parsed = tryParseJson<NewArticleOutput>(raw);
        if (!parsed) {
          errors.push({
            label: theme,
            inserted: 0,
            skipped: 0,
            errors: [{ type: "Opus", code: "PARSE_FAIL", message: `Could not parse JSON for theme ${theme}` }],
          });
          continue;
        }

        await insertAuditItem({
          audit_run_id: auditRunId,
          article_url: `new_article:${theme}`,
          article_name: parsed.suggested_title || theme,
          audit_type: "new_article",
          analysis: JSON.stringify({
            theme,
            questions_count: questions.length,
            suggested_title: parsed.suggested_title,
            recommended_space: parsed.recommended_space,
            article_md: parsed.article_md,
          }),
          image_mapping: null,
          status: "done",
        });
      }

      logger.info(`Partie B done: ${newArticleCount} new article drafts`);

      // ──────────────────────────────────────────
      // 5. Assemble final Markdown report
      // ──────────────────────────────────────────
      const allItems = await getAuditItemsByRunId(auditRunId);
      const updateItems = allItems.filter((i) => i.audit_type === "update_needed");
      const noChangeItems = allItems.filter((i) => i.audit_type === "no_change");
      const newItems = allItems.filter((i) => i.audit_type === "new_article");

      const markdown = buildReportMarkdown({
        faqVersion: faqApproved.version,
        totalArticles: allPosts.length,
        totalThemes: faq.themes.length,
        updateItems,
        noChangeItems,
        newItems,
        skippedArticles: skippedArticles.map((s) => s.post),
      });

      logger.info(`Report assembled: ${markdown.length} chars`);

      const stats = {
        faq_version: faqApproved.version,
        total_circle_posts: allPosts.length,
        articles_audited: updateItems.length + noChangeItems.length,
        articles_with_changes: updateItems.length,
        articles_no_change: noChangeItems.length,
        articles_skipped: skippedArticles.length,
        new_articles_suggested: newItems.length,
        total_faq_themes: faq.themes.length,
        uncovered_themes: uncoveredThemes.length,
      };
      const docMeta = {
        audit_run_id: auditRunId,
        generation_duration_ms: Date.now() - startTime,
      };

      const version = await insertFaqDocumentWithType(
        markdown,
        OPUS_MODEL,
        stats,
        docMeta,
        "circle_vs_faq_audit"
      );
      logger.info(`Saved circle_vs_faq_audit v${version} to Supabase`);

      await sendSuccessSlack(version, stats, docMeta);

      if (errors.length > 0) {
        await sendErrorToScriptLogs("audit-circle-vs-faq", errors);
      }

      try {
        metadata.set("version", version);
        metadata.set("articlesWithChanges", updateItems.length);
        metadata.set("newArticles", newItems.length);
        await metadata.flush();
      } catch {
        // metadata may not be available
      }

      return {
        version,
        faqVersion: faqApproved.version,
        articlesWithChanges: updateItems.length,
        articlesNoChange: noChangeItems.length,
        articlesSkipped: skippedArticles.length,
        newArticlesSuggested: newItems.length,
        durationMs: Date.now() - startTime,
        errors: errors.length,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Fatal error: ${msg}`);
      await sendErrorToScriptLogs("audit-circle-vs-faq", [
        { label: "Fatal", inserted: 0, skipped: 0, errors: [{ type: "Fatal", code: "UNHANDLED", message: msg }] },
      ]);
      throw err;
    }
  },
});

// ============================================
// PRE-MAPPING (article → FAQ themes)
// ============================================

const STOPWORDS = new Set([
  "avec", "dans", "pour", "sans", "sous", "votre", "vos", "cette", "cet", "ces",
  "mais", "donc", "puis", "tout", "tous", "toute", "toutes", "plus", "moins",
  "faire", "fait", "faites", "peut", "peux", "pouvez", "doit", "dois", "devoir",
  "etre", "avoir", "aller", "vont", "sont", "etes", "suis", "pas", "non", "oui",
  "aux", "des", "les", "une", "uns", "ils", "elles", "que", "qui", "quoi",
  "comment", "pourquoi", "quel", "quels", "quelle", "quelles", "ainsi",
  "airsaas", "prc", "circle",
]);

function normalizeTokens(input: string): Set<string> {
  const tokens = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function scoreArticleAgainstThemes(post: CirclePostForAudit, faq: ParsedFaq): string[] {
  const articleText = `${post.name}\n${post.body_plain_text?.slice(0, 2000) ?? ""}`;
  const articleTokens = normalizeTokens(articleText);
  if (articleTokens.size === 0) return [];

  const scores: { theme: string; score: number }[] = [];
  for (const theme of faq.themes) {
    const questions = faq.sectionsByTheme[theme] || [];
    const themeText = `${theme} ${questions.join(" ")}`;
    const themeTokens = normalizeTokens(themeText);

    let score = 0;
    for (const tok of themeTokens) {
      if (articleTokens.has(tok)) score++;
    }
    if (score >= MIN_THEME_SCORE) {
      scores.push({ theme, score });
    }
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, TOP_THEMES_PER_ARTICLE).map((s) => s.theme);
}

function buildFaqSectionsForThemes(themes: string[], faq: ParsedFaq): string {
  const parts: string[] = [];
  for (const theme of themes) {
    const questions = faq.sectionsByTheme[theme] || [];
    parts.push(`### Thème : ${theme}\n`);
    for (const q of questions) {
      const section = faq.sectionsByTitle[q];
      if (section) parts.push(section);
    }
  }
  return parts.join("\n\n");
}

// ============================================
// REPORT BUILDER
// ============================================

interface AuditItemRow {
  article_url: string | null;
  article_name: string | null;
  audit_type: string;
  analysis: string;
  image_mapping: Record<string, string> | null;
}

function buildReportMarkdown(input: {
  faqVersion: number;
  totalArticles: number;
  totalThemes: number;
  updateItems: AuditItemRow[];
  noChangeItems: AuditItemRow[];
  newItems: AuditItemRow[];
  skippedArticles: CirclePostForAudit[];
}): string {
  const today = new Date().toISOString().split("T")[0];
  const {
    faqVersion,
    totalArticles,
    totalThemes,
    updateItems,
    noChangeItems,
    newItems,
    skippedArticles,
  } = input;

  let md = `# Audit Circle vs FAQ — AirSaas / PRC\n\n`;
  md += `> Audit généré le ${today}\n`;
  md += `> FAQ de référence v${faqVersion} · ${totalThemes} thèmes\n`;
  md += `> ${totalArticles} articles Circle analysés\n\n`;

  md += `## Table des matières\n\n`;
  md += `1. [Articles à mettre à jour](#articles-a-mettre-a-jour) (${updateItems.length})\n`;
  md += `2. [Nouveaux articles proposés](#nouveaux-articles-proposes) (${newItems.length})\n`;
  md += `3. [Articles déjà alignés avec la FAQ](#articles-deja-alignes) (${noChangeItems.length})\n`;
  md += `4. [Articles non couverts par la FAQ](#articles-non-couverts) (${skippedArticles.length})\n\n`;
  md += `---\n\n`;

  // Section 1
  md += `## Articles à mettre à jour\n\n`;
  md += `> ${updateItems.length} articles existants dont le contenu diverge de la FAQ de référence. Pour chacun : résumé des modifications, version actuelle, version proposée.\n\n`;

  for (const item of updateItems) {
    const data = tryParseJson<{
      themes_matched: string[];
      summary_changes: string[];
      original_article_md: string;
      rewritten_article_md: string;
      space_slug: string;
    }>(item.analysis);

    md += `### 📝 ${item.article_name}\n\n`;
    md += `**URL :** ${item.article_url}\n`;
    md += `**Espace :** ${data?.space_slug ?? "—"}\n`;
    md += `**Thèmes FAQ matchés :** ${data?.themes_matched?.join(", ") ?? "—"}\n`;
    if (item.image_mapping && Object.keys(item.image_mapping).length > 0) {
      md += `**Images existantes :** ${Object.keys(item.image_mapping).length}\n`;
    }
    md += `\n`;

    md += `#### Résumé des modifications\n\n`;
    if (data?.summary_changes?.length) {
      for (const change of data.summary_changes) md += `- ${change}\n`;
    } else {
      md += `_(aucun résumé fourni)_\n`;
    }
    md += `\n`;

    md += `#### Version actuelle\n\n`;
    md += (data?.original_article_md ?? "_(contenu non disponible)_") + "\n\n";

    md += `#### Version proposée\n\n`;
    md += (data?.rewritten_article_md ?? "_(version proposée non disponible)_") + "\n\n";

    if (item.image_mapping && Object.keys(item.image_mapping).length > 0) {
      md += `<details><summary>Mapping images</summary>\n\n`;
      for (const [ph, url] of Object.entries(item.image_mapping)) {
        md += `- ${ph} → ${url}\n`;
      }
      md += `\n</details>\n\n`;
    }
    md += `---\n\n`;
  }

  // Section 2
  md += `## Nouveaux articles proposés\n\n`;
  md += `> ${newItems.length} thèmes FAQ ne sont couverts par aucun article Circle. Voici les brouillons proposés.\n\n`;

  for (const item of newItems) {
    const data = tryParseJson<{
      theme: string;
      questions_count: number;
      suggested_title: string;
      recommended_space: string;
      article_md: string;
    }>(item.analysis);

    md += `### 🆕 ${data?.suggested_title ?? item.article_name}\n\n`;
    md += `**Thème FAQ :** ${data?.theme ?? "—"}\n`;
    md += `**Questions FAQ couvertes :** ${data?.questions_count ?? "—"}\n`;
    md += `**Espace recommandé :** ${data?.recommended_space ?? "—"}\n\n`;
    md += (data?.article_md ?? "_(brouillon non disponible)_") + "\n\n";
    md += `---\n\n`;
  }

  // Section 3
  md += `## Articles déjà alignés\n\n`;
  md += `> ${noChangeItems.length} articles jugés conformes à la FAQ, aucune modification proposée.\n\n`;
  for (const item of noChangeItems) {
    md += `- **${item.article_name}** — ${item.article_url}\n`;
  }
  md += `\n`;

  // Section 4
  md += `## Articles non couverts\n\n`;
  md += `> ${skippedArticles.length} articles Circle dont le sujet n'a aucun recouvrement avec la FAQ — skippés (rien à proposer).\n\n`;
  for (const p of skippedArticles) {
    md += `- **${p.name}** (espace : ${p.space_slug}) — ${p.url}\n`;
  }

  return md;
}

// ============================================
// HELPERS
// ============================================

function tryParseJson<T>(raw: string): T | null {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  if (!text.startsWith("{") && !text.startsWith("[")) {
    const firstBrace = text.indexOf("{");
    const firstBracket = text.indexOf("[");
    const start =
      firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
    if (start !== -1) {
      const closer = text[start] === "{" ? "}" : "]";
      const end = text.lastIndexOf(closer);
      if (end > start) text = text.slice(start, end + 1);
    }
  }
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    logger.warn(`Failed to parse JSON: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function sendSlack(text: string): Promise<void> {
  const webhook = process.env.script_logs ?? "";
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    logger.error("Failed to send Slack", { error: err instanceof Error ? err.message : String(err) });
  }
}

async function sendSuccessSlack(
  version: number,
  stats: Record<string, unknown>,
  docMeta: Record<string, unknown>
): Promise<void> {
  const durationMin = Math.round((docMeta.generation_duration_ms as number) / 60000);
  const message = `📋 *[audit-circle-vs-faq]* ✅ v${version} — ${new Date().toISOString().split("T")[0]}

📊 Résultats
• Articles à modifier: ${stats.articles_with_changes}
• Articles déjà alignés: ${stats.articles_no_change}
• Articles skippés (non couverts): ${stats.articles_skipped}
• Nouveaux articles proposés: ${stats.new_articles_suggested}
• FAQ référence: v${stats.faq_version} (${stats.total_faq_themes} thèmes, ${stats.uncovered_themes} sans article)
• Durée: ${durationMin}min

💾 Rapport sauvegardé dans \`tchat_faq_documents\` (type=circle_vs_faq_audit, v${version})`;

  await sendSlack(message);
}
