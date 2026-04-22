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
const MAX_TOKENS_FILTER = 800;
const MAX_TOKENS_REVIEW = 1500;
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

Ta mission : auditer l'article par rapport à la FAQ et produire une version corrigée UNIQUEMENT si une réécriture est justifiée.

RÈGLE ABSOLUE — NE RIEN INVENTER :
- Tu ne peux affirmer QUE ce qui est présent dans l'article original OU dans la FAQ fournie.
- Interdit d'inventer des fonctionnalités, des chiffres, des étapes, des intégrations, des évolutions, des cas d'usage.
- Interdit d'extrapoler à partir du titre ou des thèmes : si l'info n'existe ni dans l'article ni dans la FAQ, elle n'existe pas.

QUAND NE RIEN RÉÉCRIRE (→ renvoie summary_changes: [] et rewritten_article_md: "") :
- L'article est une annonce produit courte (nouvelle fonctionnalité, teaser, changelog) sans contenu documentaire à corriger.
- L'article est déjà factuellement aligné avec la FAQ (pas de contradiction, pas de trou de documentation comblable AVEC la FAQ fournie).
- Le sujet réel de l'article est tangent aux thèmes FAQ : les points communs sont lexicaux mais pas substantiels.
- La seule réécriture possible serait d'ajouter du contenu inventé pour "enrichir".

QUAND RÉÉCRIRE (→ summary_changes non vide) :
- L'article contient une erreur factuelle que la FAQ corrige.
- L'article omet une information CRITIQUE présente dans la FAQ, qui s'inscrit naturellement dans son sujet et sa longueur.
- Une incohérence ou ambiguïté peut être levée via la FAQ.

RÈGLES DE RÉÉCRITURE (quand elle est justifiée) :
- Conserve TOUTES les images [IMAGE_N] existantes à leur position logique. Ne supprime JAMAIS une image.
- Si un nouveau passage mériterait une illustration, ajoute [NOUVELLE_IMAGE: description].
- Garde le ton, le style ET la LONGUEUR de l'article original (±30% max). Ne transforme pas une annonce en guide complet.
- Reste dans le périmètre du sujet original : n'élargis pas à des fonctionnalités voisines.
- Pas de nom de client ou d'entreprise cliente. Écris en français. Sois factuel et actionnable.

FORMAT DE SORTIE — JSON strict, pas de prose, pas de backticks :
{
  "summary_changes": [
    "Description concise du changement 1",
    "Description concise du changement 2",
    "..."
  ],
  "rewritten_article_md": "L'article complet réécrit en markdown, avec [IMAGE_N] à leur place."
}

Si aucune réécriture n'est justifiée (voir QUAND NE RIEN RÉÉCRIRE), réponds :
{
  "summary_changes": [],
  "rewritten_article_md": ""
}`;

const MAPPING_FILTER_SYSTEM = `Tu es un expert en documentation produit pour AirSaas / PRC (SaaS B2B de gestion de projets).

Tu reçois :
1. Un article Circle (titre + début du contenu)
2. Les thèmes FAQ qui lui ont été associés par un mapping lexical (mots-clés communs)

Le mapping lexical peut produire de faux positifs (ex: article de test, blague, sujet hors-produit qui partage juste quelques mots).

Ta mission : dire si le sujet RÉEL de l'article est sémantiquement couvert par au moins un de ces thèmes FAQ.

Critères :
- "relevant" : l'article traite vraiment d'un sujet qui correspond à au moins un thème (même partiellement)
- "off_topic" : l'article traite d'un sujet étranger aux thèmes (test, blague, sujet hors-produit, contenu poubelle)

FORMAT JSON strict, pas de prose, pas de backticks :
{
  "verdict": "relevant" | "off_topic",
  "reason": "Phrase courte expliquant la décision",
  "best_theme": "Le thème le plus pertinent parmi ceux proposés, ou null si off_topic"
}`;

const REVIEW_SYSTEM = `Tu es un relecteur CRITIQUE et exigeant en documentation produit pour AirSaas / PRC.

Tu reçois :
1. Un article Circle ORIGINAL (avant modification)
2. Une RÉÉCRITURE proposée, censée corriger l'article selon la FAQ de référence
3. Les thèmes FAQ ciblés

Ta mission : juger sévèrement la qualité de la réécriture. Cherche activement les problèmes.

Critères éliminatoires (→ "regenerate" ou "skip") :
- La réécriture parle d'un SUJET DIFFÉRENT de l'original (drift, hallucination)
- La réécriture affirme des choses NI dans la FAQ NI dans l'original (invention)
- La réécriture perd des informations importantes de l'original sans raison
- La réécriture mentionne des fonctionnalités ou concepts étrangers à l'article

Critères de qualité (→ "keep" si OK) :
- Reste fidèle au sujet de l'article original
- Intègre correctement les corrections issues de la FAQ
- Préserve les images [IMAGE_N] existantes
- Ton cohérent avec le style Circle (tutoriel, guide)

Verdicts :
- "keep" : réécriture correcte, à conserver telle quelle
- "regenerate" : dérives mineures corrigibles, à régénérer avec des instructions précises
- "skip" : dérive majeure, mapping probablement incorrect, abandonner cette réécriture

FORMAT JSON strict, pas de prose, pas de backticks :
{
  "verdict": "keep" | "regenerate" | "skip",
  "severity": "ok" | "minor" | "major",
  "issues": ["Problème concret 1", "Problème concret 2"],
  "regeneration_hint": "Instructions précises pour régénérer correctement, ou chaîne vide si verdict != regenerate"
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

interface FilterOutput {
  verdict: "relevant" | "off_topic";
  reason: string;
  best_theme: string | null;
}

interface ReviewOutput {
  verdict: "keep" | "regenerate" | "skip";
  severity: "ok" | "minor" | "major";
  issues: string[];
  regeneration_hint: string;
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
  maxDuration: 14400, // 4h — 3 Opus passes per article, 160 articles = ~3h
  run: async (payload?: { dryRun?: boolean; resumeRunId?: string }) => {
    const startTime = Date.now();
    const dryRun = payload?.dryRun ?? false;
    const auditRunId = payload?.resumeRunId ?? crypto.randomUUID();
    const resuming = Boolean(payload?.resumeRunId);
    const errors: TaskResultGroup[] = [];

    logger.info(
      `=== START audit-circle-vs-faq (runId=${auditRunId}, dryRun=${dryRun}, resuming=${resuming}) ===`
    );

    try {
      // ──────────────────────────────────────────
      // 1. Load FAQ + Circle posts
      // ──────────────────────────────────────────
      const [faqApproved, allPostsRaw] = await Promise.all([
        getFaqApproved(),
        getAllCirclePosts(),
      ]);

      if (!faqApproved) {
        const msg = "No approved FAQ found in Supabase (type=faq_approved). Run scripts/upload-faq-approved.ts first.";
        logger.error(msg);
        await sendSlack(`❌ [audit-circle-vs-faq] ${msg}`);
        return { error: msg };
      }

      // Exclure l'espace "utilisateurs-d-airsaas" : contenu communautaire,
      // pas de la doc officielle (on ne l'audite pas ni ne le réécrit).
      const EXCLUDED_SPACES = new Set(["utilisateurs-d-airsaas"]);
      const allPosts = allPostsRaw.filter((p) => !EXCLUDED_SPACES.has(p.space_slug));
      const excludedCount = allPostsRaw.length - allPosts.length;

      const faq = parseFaq(faqApproved.markdown);
      logger.info(
        `FAQ v${faqApproved.version}: ${faq.themes.length} themes, ${Object.keys(faq.sectionsByTitle).length} questions. Circle posts: ${allPosts.length} published (${excludedCount} exclus: ${[...EXCLUDED_SPACES].join(", ")}).`
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

      // Resume: build set of URLs already done for this run_id,
      // et reconstruire la couverture post-filtre depuis les items existants.
      const alreadyDone = new Set<string>();
      const postFilterCoveredThemes = new Set<string>();
      if (resuming) {
        const existing = await getAuditItemsByRunId(auditRunId);
        for (const item of existing) {
          if (item.article_url) alreadyDone.add(item.article_url);
          if (item.audit_type === "update_needed" || item.audit_type === "no_change") {
            try {
              const analysis = JSON.parse(item.analysis || "{}");
              const themes: string[] = analysis.themes_matched || [];
              for (const t of themes) postFilterCoveredThemes.add(t);
            } catch {
              // ignore malformed analysis JSON
            }
          }
        }
        logger.info(`Resume: ${alreadyDone.size} items already done for runId=${auditRunId}`);
      }

      // ──────────────────────────────────────────
      // 3. Partie A — audit covered articles (filter → rewrite → review)
      // ──────────────────────────────────────────
      let auditedCount = 0;
      let skippedResumeCount = 0;
      let noChangeCount = 0;
      let offTopicCount = 0;
      let regeneratedCount = 0;

      for (let i = 0; i < coveredArticles.length; i++) {
        const { post, themes } = coveredArticles[i];

        if (alreadyDone.has(post.url)) {
          skippedResumeCount++;
          continue;
        }

        auditedCount++;
        logger.info(
          `[Partie A ${auditedCount}/${coveredArticles.length - skippedResumeCount}] "${post.name}" (themes: ${themes.join(", ")})`
        );

        const { markdown: articleMd, imageMapping } = htmlToMarkdownWithImages(post.body_html);
        const faqSections = buildFaqSectionsForThemes(themes, faq);
        const commentsText = formatComments(post.comments);

        // ---- Pass 1: upstream filter (reject off-topic mappings) ----
        const filterPrompt = `## ARTICLE CIRCLE

**Titre :** ${post.name}
**Espace :** ${post.space_slug}

### Extrait du contenu (premiers 1500 caractères)
${articleMd.slice(0, 1500)}

---

## THÈMES FAQ ASSOCIÉS PAR LE MAPPING

${themes.map((t) => `- ${t}`).join("\n")}`;

        const filterRaw = await callOpus(
          client,
          OPUS_MODEL,
          MAPPING_FILTER_SYSTEM,
          filterPrompt,
          MAX_TOKENS_FILTER,
          TEMPERATURE
        );
        const filterResult = filterRaw ? tryParseJson<FilterOutput>(filterRaw) : null;

        if (filterResult?.verdict === "off_topic") {
          offTopicCount++;
          logger.info(`  ⏭  off_topic: ${filterResult.reason}`);
          await insertAuditItem({
            audit_run_id: auditRunId,
            article_url: post.url,
            article_name: post.name,
            audit_type: "off_topic",
            analysis: JSON.stringify({
              themes_matched: themes,
              filter_reason: filterResult.reason,
              best_theme: filterResult.best_theme,
              original_article_md: articleMd,
              space_slug: post.space_slug,
              rejected_at: "filter",
            }),
            image_mapping: imageMapping,
            status: "done",
          });
          continue;
        }

        // ---- Pass 2: rewrite ----
        const rewritePrompt = `## ARTICLE À AUDITER

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

        let rewriteParsed = await generateRewrite(client, rewritePrompt);
        if (!rewriteParsed) {
          errors.push({
            label: post.name,
            inserted: 0,
            skipped: 0,
            errors: [{ type: "Opus", code: "REWRITE_FAIL", message: `Article rewrite failed: ${post.url}` }],
          });
          continue;
        }

        const hasChanges = rewriteParsed.summary_changes.length > 0 && rewriteParsed.rewritten_article_md.trim().length > 0;

        // No changes proposed — skip review, store as no_change
        if (!hasChanges) {
          noChangeCount++;
          for (const t of themes) postFilterCoveredThemes.add(t);
          await insertAuditItem({
            audit_run_id: auditRunId,
            article_url: post.url,
            article_name: post.name,
            audit_type: "no_change",
            analysis: JSON.stringify({
              themes_matched: themes,
              summary_changes: rewriteParsed.summary_changes,
              original_article_md: articleMd,
              rewritten_article_md: rewriteParsed.rewritten_article_md,
              space_slug: post.space_slug,
            }),
            image_mapping: imageMapping,
            status: "done",
          });
          continue;
        }

        // ---- Pass 3: review (self-critique), with 1 regeneration retry ----
        let finalRewrite = rewriteParsed;
        let reviewResult = await reviewRewrite(client, post.name, themes, articleMd, rewriteParsed.rewritten_article_md);
        let regenerated = false;

        if (reviewResult?.verdict === "regenerate") {
          regeneratedCount++;
          logger.info(`  🔁 regenerate: ${reviewResult.issues.join("; ")}`);
          const retryPrompt = `${rewritePrompt}

---

## RETOUR DU RELECTEUR SUR LA 1ÈRE VERSION (à corriger)
${reviewResult.issues.map((x) => `- ${x}`).join("\n")}

Instructions précises : ${reviewResult.regeneration_hint}`;
          const retry = await generateRewrite(client, retryPrompt);
          if (retry) {
            finalRewrite = retry;
            regenerated = true;
            reviewResult = await reviewRewrite(client, post.name, themes, articleMd, retry.rewritten_article_md);
          }
        }

        // After (possibly) regenerating, if review still says skip/regenerate → mark off_topic
        if (reviewResult?.verdict === "skip" || reviewResult?.verdict === "regenerate") {
          offTopicCount++;
          logger.info(`  ⚠️  review_rejected: ${reviewResult.issues.join("; ")}`);
          await insertAuditItem({
            audit_run_id: auditRunId,
            article_url: post.url,
            article_name: post.name,
            audit_type: "off_topic",
            analysis: JSON.stringify({
              themes_matched: themes,
              filter_reason: reviewResult.issues.join("; "),
              original_article_md: articleMd,
              rejected_rewrite_md: finalRewrite.rewritten_article_md,
              space_slug: post.space_slug,
              rejected_at: "review",
              regeneration_attempted: regenerated,
              review_severity: reviewResult.severity,
            }),
            image_mapping: imageMapping,
            status: "done",
          });
          continue;
        }

        // Review OK (keep) or review call failed — store as update_needed
        for (const t of themes) postFilterCoveredThemes.add(t);
        await insertAuditItem({
          audit_run_id: auditRunId,
          article_url: post.url,
          article_name: post.name,
          audit_type: "update_needed",
          analysis: JSON.stringify({
            themes_matched: themes,
            summary_changes: finalRewrite.summary_changes,
            original_article_md: articleMd,
            rewritten_article_md: finalRewrite.rewritten_article_md,
            space_slug: post.space_slug,
            review: reviewResult ?? null,
            regenerated,
          }),
          image_mapping: imageMapping,
          status: "done",
        });
      }

      logger.info(
        `Partie A done: ${auditedCount} audited, ${skippedResumeCount} resumed (${noChangeCount} no-change, ${offTopicCount} off-topic, ${regeneratedCount} regenerated)`
      );

      // ──────────────────────────────────────────
      // 4. Partie B — brouillons pour thèmes sans article retenu (post-filtre)
      // ──────────────────────────────────────────
      // Un thème est "vraiment couvert" uniquement s'il a au moins un article
      // retenu (update_needed ou no_change). Les thèmes dont tous les articles
      // ont été rejetés (off_topic) sont considérés comme uncovered et
      // déclenchent un brouillon d'article.
      const realUncoveredThemes = faq.themes.filter((t) => !postFilterCoveredThemes.has(t));
      logger.info(
        `Post-filter coverage: ${postFilterCoveredThemes.size}/${faq.themes.length} thèmes avec ≥1 article retenu. ${realUncoveredThemes.length} thèmes uncovered (lexical: ${uncoveredThemes.length}).`
      );

      let newArticleCount = 0;

      for (const theme of realUncoveredThemes) {
        const questions = faq.sectionsByTheme[theme] || [];
        if (questions.length === 0) continue;

        const themeKey = `new_article:${theme}`;
        if (alreadyDone.has(themeKey)) {
          skippedResumeCount++;
          continue;
        }

        newArticleCount++;
        logger.info(
          `[Partie B ${newArticleCount}/${realUncoveredThemes.length}] Theme without kept article: "${theme}" (${questions.length} questions)`
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
      const offTopicItems = allItems.filter((i) => i.audit_type === "off_topic");
      const newItems = allItems.filter((i) => i.audit_type === "new_article");

      const markdown = buildReportMarkdown({
        faqVersion: faqApproved.version,
        totalArticles: allPosts.length,
        totalThemes: faq.themes.length,
        updateItems,
        noChangeItems,
        offTopicItems,
        newItems,
        skippedArticles: skippedArticles.map((s) => s.post),
      });

      logger.info(`Report assembled: ${markdown.length} chars`);

      const stats = {
        faq_version: faqApproved.version,
        total_circle_posts: allPosts.length,
        articles_audited: updateItems.length + noChangeItems.length + offTopicItems.length,
        articles_with_changes: updateItems.length,
        articles_no_change: noChangeItems.length,
        articles_off_topic: offTopicItems.length,
        articles_regenerated: regeneratedCount,
        articles_skipped: skippedArticles.length,
        new_articles_suggested: newItems.length,
        total_faq_themes: faq.themes.length,
        uncovered_themes: realUncoveredThemes.length,
        uncovered_themes_lexical: uncoveredThemes.length,
      };
      const docMeta = {
        audit_run_id: auditRunId,
        generation_duration_ms: Date.now() - startTime,
        resumed_items: skippedResumeCount,
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
  offTopicItems: AuditItemRow[];
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
    offTopicItems,
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
  md += `4. [Articles rejetés par l'audit IA](#articles-rejetes) (${offTopicItems.length})\n`;
  md += `5. [Articles non couverts par la FAQ](#articles-non-couverts) (${skippedArticles.length})\n\n`;
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

  // Section 4 — articles rejected by filter or review
  md += `## Articles rejetés par l'audit IA\n\n`;
  md += `> ${offTopicItems.length} articles dont le mapping lexical a été invalidé par l'audit IA (hors-sujet au filtre, ou dérive détectée par le relecteur).\n\n`;
  if (offTopicItems.length === 0) {
    md += `_(aucun article rejeté)_\n\n`;
  } else {
    for (const item of offTopicItems) {
      const data = tryParseJson<{
        themes_matched: string[];
        filter_reason: string;
        best_theme: string | null;
        space_slug: string;
        rejected_at: string;
        regeneration_attempted?: boolean;
        review_severity?: string;
      }>(item.analysis);

      md += `### 🚫 ${item.article_name}\n\n`;
      md += `**URL :** ${item.article_url}\n`;
      md += `**Espace :** ${data?.space_slug ?? "—"}\n`;
      md += `**Thèmes mappés (rejetés) :** ${data?.themes_matched?.join(", ") ?? "—"}\n`;
      md += `**Rejeté à :** ${data?.rejected_at === "filter" ? "filtre amont" : "relecture post-réécriture"}\n`;
      if (data?.review_severity) {
        md += `**Sévérité :** ${data.review_severity}\n`;
      }
      if (data?.regeneration_attempted) {
        md += `**Régénération tentée :** oui (sans succès)\n`;
      }
      md += `**Raison :** ${data?.filter_reason ?? "—"}\n\n`;
      md += `---\n\n`;
    }
  }

  // Section 5
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

async function generateRewrite(client: Anthropic, userPrompt: string): Promise<ArticleAuditOutput | null> {
  const raw = await callOpus(
    client,
    OPUS_MODEL,
    ARTICLE_AUDIT_SYSTEM,
    userPrompt,
    MAX_TOKENS_PER_ARTICLE,
    TEMPERATURE
  );
  if (!raw) return null;
  return tryParseJson<ArticleAuditOutput>(raw);
}

async function reviewRewrite(
  client: Anthropic,
  articleName: string,
  themes: string[],
  originalMd: string,
  rewrittenMd: string
): Promise<ReviewOutput | null> {
  const prompt = `## ARTICLE ORIGINAL

**Titre :** ${articleName}
**Thèmes FAQ ciblés :** ${themes.join(", ")}

${originalMd}

---

## RÉÉCRITURE PROPOSÉE

${rewrittenMd}`;

  const raw = await callOpus(client, OPUS_MODEL, REVIEW_SYSTEM, prompt, MAX_TOKENS_REVIEW, TEMPERATURE);
  if (!raw) return null;
  return tryParseJson<ReviewOutput>(raw);
}

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
• Articles rejetés par l'audit IA: ${stats.articles_off_topic} (dont ${stats.articles_regenerated} régénérés)
• Articles skippés (non couverts): ${stats.articles_skipped}
• Nouveaux articles proposés: ${stats.new_articles_suggested}
• FAQ référence: v${stats.faq_version} (${stats.total_faq_themes} thèmes, ${stats.uncovered_themes} sans article)
• Durée: ${durationMin}min

💾 Rapport sauvegardé dans \`tchat_faq_documents\` (type=circle_vs_faq_audit, v${version})`;

  await sendSlack(message);
}
