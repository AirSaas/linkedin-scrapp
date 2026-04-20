import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sendErrorToScriptLogs, type TaskError, type TaskResultGroup } from "./lib/utils.js";
import {
  getFaqApproved,
  getRecentFaqExtractions,
  getRecentCirclePosts,
  insertFaqDocumentWithType,
  type FaqEntry,
  type CirclePostForAudit,
} from "./lib/crisp-supabase.js";
import { parseFaq } from "./lib/faq-parser.js";

// ============================================
// CONFIGURATION
// ============================================

const OPUS_MODEL = "claude-opus-4-20250514";
const MAX_TOKENS = 16000;
const TEMPERATURE = 0.3;
const DEFAULT_LOOKBACK_DAYS = 30;
const TRIAGE_BATCH_SIZE = 50; // Max extractions per triage call
const DETAIL_BATCH_SIZE = 8; // Max proposals per detail call

// ============================================
// TYPES
// ============================================

interface Proposal {
  type: "new_question" | "update_answer" | "remove_question" | "update_article" | "new_article";
  faq_question_title?: string;
  theme?: string;
  reason: string;
  extraction_ids: string[];
  // Filled in Phase 2
  detail?: string;
  before?: string;
  after?: string;
}

// ============================================
// PROMPTS
// ============================================

const TRIAGE_SYSTEM_PROMPT = `Tu es un expert produit AirSaas / PRC (SaaS B2B de gestion de projets).

Tu reçois :
1. La TABLE DES MATIÈRES complète de la FAQ de référence (thèmes + titres de questions)
2. Des NOUVELLES EXTRACTIONS FAQ issues de conversations Crisp récentes (format JSON compact)
3. La LISTE DES ARTICLES CIRCLE récents (titres + URLs)

Ta mission : identifier les propositions de changements à la FAQ et aux articles Circle.

CATÉGORIES :
- new_question : question qui n'existe PAS dans la FAQ actuelle et qui mérite d'être ajoutée
- update_answer : question EXISTANTE dont la réponse doit être mise à jour (nouvelle info, correction, complément)
- remove_question : question OBSOLÈTE à supprimer (le sujet n'est plus pertinent, la feature a changé radicalement)
- update_article : article Circle EXISTANT à mettre à jour (info obsolète, compléments nécessaires)
- new_article : nouvel article Circle à créer (thème couvert par la FAQ mais pas par un article)

RÈGLES :
- Sois SÉLECTIF : ne propose que des changements vraiment justifiés par les extractions récentes
- Pour update_answer, la raison doit clairement expliquer CE QUI A CHANGÉ
- Pour new_question, vérifie bien qu'aucune question existante ne couvre déjà le sujet (même sous un autre angle)
- Pour remove_question, il faut une raison solide (pas juste "peu posée")
- Inclus les session_ids des extractions qui justifient chaque proposition dans extraction_ids
- Ne propose PAS de changements cosmétiques (reformulations mineures, typos)

Réponds UNIQUEMENT en JSON valide : un tableau d'objets.
Chaque objet : { "type": "...", "faq_question_title": "...", "theme": "...", "reason": "...", "extraction_ids": ["session_id1", ...] }
Pas de markdown, pas de backticks, juste le JSON.`;

const DETAIL_UPDATE_PROMPT = `Tu es un rédacteur technique expert pour la FAQ produit AirSaas / PRC.

Tu reçois :
1. Le CONTENU ACTUEL d'une section de la FAQ (question + réponse)
2. Les EXTRACTIONS de conversations Crisp qui justifient la mise à jour
3. La RAISON de la mise à jour

Ta mission : produire la version mise à jour de la réponse FAQ.

RÈGLES :
- Conserve le style et le format de la FAQ existante
- Ne change QUE ce qui est justifié par les extractions
- Produis un diff clair : marque les AJOUTS avec [+] et les SUPPRESSIONS avec [-]
- La réponse doit rester autonome et compréhensible
- Pas de nom de client, pas de date relative
- Date du jour : ${new Date().toISOString().slice(0, 10)}

Réponds en JSON : { "before": "contenu actuel (copie)", "after": "contenu mis à jour", "changes_summary": "résumé des changements en 1-2 phrases" }`;

const DETAIL_NEW_QUESTION_PROMPT = `Tu es un rédacteur technique expert pour la FAQ produit AirSaas / PRC.

Tu reçois des EXTRACTIONS de conversations Crisp qui révèlent une question fréquente non couverte par la FAQ.

Ta mission : rédiger une nouvelle entrée FAQ complète.

RÈGLES :
- Titre clair et actionnable (commence par "Comment", "Pourquoi", "Que faire si", etc.)
- Réponse structurée avec des étapes concrètes si applicable
- Inclus les cas de figure identifiés dans les conversations
- Pas de nom de client, pas de date relative
- Date du jour : ${new Date().toISOString().slice(0, 10)}
- FORMATAGE MARKDOWN : bullet points avec "- ", sous-titres en **Gras**

Réponds en JSON : { "suggested_title": "...", "suggested_answer": "...", "suggested_theme": "..." }`;

const DETAIL_ARTICLE_PROMPT = `Tu es un rédacteur technique expert pour AirSaas / PRC.

Tu reçois :
1. Un ARTICLE CIRCLE existant (ou la demande d'en créer un nouveau)
2. Les EXTRACTIONS de conversations Crisp qui justifient la modification/création
3. La RAISON de la modification

Ta mission : produire une proposition de modification ou un brouillon de nouvel article.

RÈGLES :
- Pour une mise à jour : produis le diagnostic + les modifications à apporter
- Pour un nouvel article : produis un brouillon complet
- Conserve le ton communautaire de Circle (tutoriel, guide pratique)
- Pas de nom de client

Réponds en JSON : { "diagnostic": "...", "proposition": "...", "type": "update|create" }`;

// ============================================
// MAIN TASK
// ============================================

export const proposeFaqUpdates = task({
  id: "propose-faq-updates",
  maxDuration: 1800, // 30 min — multiple Opus calls
  run: async (payload?: { lookbackDays?: number }) => {
    const lookbackDays = payload?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    const errors: TaskError[] = [];
    const startTime = Date.now();

    logger.info(`=== START propose-faq-updates (lookback ${lookbackDays}d) ===`);

    // ──────────────────────────────────────────
    // Phase 1: Collect data
    // ──────────────────────────────────────────

    // 1a. Read approved FAQ
    const faqApproved = await getFaqApproved();
    if (!faqApproved) {
      const msg = "No approved FAQ found in Supabase (type=faq_approved). Upload one first.";
      logger.error(msg);
      await sendSlackNotification(`❌ ${msg}`);
      return { error: msg };
    }
    logger.info(`FAQ reference loaded: v${faqApproved.version}, ${faqApproved.markdown.length} chars`);

    // 1b. Parse FAQ into TOC + sections index
    const { toc, sectionsByTitle } = parseFaq(faqApproved.markdown);
    logger.info(`FAQ parsed: ${toc.length} lines in TOC, ${Object.keys(sectionsByTitle).length} sections indexed`);

    // 1c. Fetch recent extractions
    const extractions = await getRecentFaqExtractions(lookbackDays);
    logger.info(`Recent extractions: ${extractions.length} entries (score >= 3, last ${lookbackDays}d)`);

    if (extractions.length === 0) {
      const msg = `No new FAQ extractions in the last ${lookbackDays} days. Nothing to propose.`;
      logger.info(msg);
      await sendSlackNotification(`ℹ️ [propose-faq-updates] ${msg}`);
      return { skipped: true, reason: "no_extractions" };
    }

    // 1d. Fetch recent Circle posts
    const circlePosts = await getRecentCirclePosts(lookbackDays);
    logger.info(`Recent Circle posts: ${circlePosts.length} (last ${lookbackDays}d)`);

    try {
      metadata.set("extractions_count", extractions.length);
      metadata.set("circle_posts_count", circlePosts.length);
      metadata.set("faq_sections_count", Object.keys(sectionsByTitle).length);
      await metadata.flush();
    } catch { /* */ }

    // ──────────────────────────────────────────
    // Phase 2: Triage (Pass 1) — TOC + extractions → proposals
    // ──────────────────────────────────────────

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    let allProposals: Proposal[] = [];

    // Batch extractions if too many
    const extractionBatches = chunkArray(extractions, TRIAGE_BATCH_SIZE);
    logger.info(`Triage: ${extractionBatches.length} batch(es) of extractions`);

    for (let i = 0; i < extractionBatches.length; i++) {
      const batch = extractionBatches[i];
      logger.info(`Triage batch ${i + 1}/${extractionBatches.length}: ${batch.length} extractions`);

      try {
        const proposals = await triageCall(client, toc.join("\n"), batch, circlePosts);
        allProposals.push(...proposals);
        logger.info(`Triage batch ${i + 1}: ${proposals.length} proposals`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Triage batch ${i + 1} failed: ${msg}`);
        errors.push({ type: `triage_batch_${i + 1}`, message: msg, code: "TRIAGE_ERROR" });
      }
    }

    // Deduplicate proposals by title
    allProposals = deduplicateProposals(allProposals);
    logger.info(`After dedup: ${allProposals.length} proposals`);

    if (allProposals.length === 0) {
      const msg = "Triage found no proposals. FAQ is up to date.";
      logger.info(msg);
      await sendSlackNotification(`✅ [propose-faq-updates] ${msg} (${extractions.length} extractions analysées)`);
      return { proposals: 0, extractions: extractions.length };
    }

    // ──────────────────────────────────────────
    // Phase 3: Detail (Pass 2) — per-proposal enrichment
    // ──────────────────────────────────────────

    const detailedProposals: Proposal[] = [];
    const proposalBatches = chunkArray(allProposals, DETAIL_BATCH_SIZE);
    logger.info(`Detail: ${proposalBatches.length} batch(es) of proposals`);

    for (let i = 0; i < proposalBatches.length; i++) {
      const batch = proposalBatches[i];
      logger.info(`Detail batch ${i + 1}/${proposalBatches.length}: ${batch.length} proposals`);

      for (const proposal of batch) {
        try {
          const enriched = await detailCall(
            client,
            proposal,
            sectionsByTitle,
            extractions,
            circlePosts
          );
          detailedProposals.push(enriched);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Detail failed for "${proposal.faq_question_title || proposal.type}": ${msg}`);
          errors.push({
            type: `detail_${proposal.type}_${proposal.faq_question_title || "unknown"}`,
            message: msg,
            code: "DETAIL_ERROR",
          });
          // Keep proposal without detail
          detailedProposals.push(proposal);
        }
      }
    }

    // ──────────────────────────────────────────
    // Phase 4: Build HTML
    // ──────────────────────────────────────────

    const html = buildProposalHtml(detailedProposals, {
      lookbackDays,
      extractionsCount: extractions.length,
      circlePostsCount: circlePosts.length,
      faqVersion: faqApproved.version,
    });
    logger.info(`HTML generated: ${html.length} chars`);

    // ──────────────────────────────────────────
    // Phase 5: Store + notify
    // ──────────────────────────────────────────

    const proposalCounts = {
      new_question: detailedProposals.filter((p) => p.type === "new_question").length,
      update_answer: detailedProposals.filter((p) => p.type === "update_answer").length,
      remove_question: detailedProposals.filter((p) => p.type === "remove_question").length,
      update_article: detailedProposals.filter((p) => p.type === "update_article").length,
      new_article: detailedProposals.filter((p) => p.type === "new_article").length,
    };

    const version = await insertFaqDocumentWithType(
      html,
      OPUS_MODEL,
      { proposalCounts, extractionsAnalyzed: extractions.length, circlePostsAnalyzed: circlePosts.length },
      { lookbackDays, duration_ms: Date.now() - startTime, errors: errors.length },
      "faq_proposal"
    );

    logger.info(`Stored as faq_proposal v${version}`);

    // Slack notification
    const durationMin = Math.round((Date.now() - startTime) / 60000);
    const slackMsg = `📋 *[propose-faq-updates]* v${version} — ${new Date().toISOString().split("T")[0]}

📊 *${detailedProposals.length} propositions* (${extractions.length} extractions, ${circlePosts.length} articles Circle analysés, ${lookbackDays}j)
• ➕ ${proposalCounts.new_question} nouvelles questions
• ✏️ ${proposalCounts.update_answer} réponses à mettre à jour
• 🗑️ ${proposalCounts.remove_question} questions à supprimer
• 📝 ${proposalCounts.update_article} articles Circle à modifier
• 📄 ${proposalCounts.new_article} nouveaux articles Circle

⏱️ ${durationMin} min${errors.length > 0 ? ` | ⚠️ ${errors.length} erreur(s)` : ""}`;

    await sendSlackNotification(slackMsg);

    if (errors.length > 0) {
      const errorGroups: TaskResultGroup[] = [{
        label: "propose-faq-updates",
        inserted: 0,
        skipped: 0,
        errors,
      }];
      await sendErrorToScriptLogs("propose-faq-updates", errorGroups);
    }

    return {
      version,
      proposals: detailedProposals.length,
      proposalCounts,
      extractionsAnalyzed: extractions.length,
      circlePostsAnalyzed: circlePosts.length,
      durationMs: Date.now() - startTime,
      errors: errors.length,
    };
  },
});

// ============================================
// TRIAGE CALL (Pass 1)
// ============================================

async function triageCall(
  client: Anthropic,
  tocText: string,
  extractions: FaqEntry[],
  circlePosts: CirclePostForAudit[]
): Promise<Proposal[]> {
  const compactExtractions = extractions.map((e) => ({
    sid: e.session_id,
    q: e.suggested_faq_title,
    a: e.suggested_faq_answer?.slice(0, 200),
    theme: e.theme,
    score: e.faq_score,
    signal: e.signal,
  }));

  const circleList = circlePosts.map((p) => `- ${p.name} (${p.url})`).join("\n");

  const userPrompt = `=== TABLE DES MATIÈRES FAQ ===
${tocText}

=== NOUVELLES EXTRACTIONS (${extractions.length}) ===
${JSON.stringify(compactExtractions, null, 0)}

=== ARTICLES CIRCLE RÉCENTS (${circlePosts.length}) ===
${circleList || "(aucun)"}

Analyse et propose les changements nécessaires :`;

  const stream = client.messages.stream({
    model: OPUS_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: TRIAGE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const message = await stream.finalMessage();
  const text = extractJsonText(message);
  const parsed = JSON.parse(text);

  if (!Array.isArray(parsed)) {
    logger.warn("Triage returned non-array", { type: typeof parsed });
    return [];
  }

  return parsed as Proposal[];
}

// ============================================
// DETAIL CALL (Pass 2)
// ============================================

async function detailCall(
  client: Anthropic,
  proposal: Proposal,
  sectionsByTitle: Record<string, string>,
  extractions: FaqEntry[],
  circlePosts: CirclePostForAudit[]
): Promise<Proposal> {
  // Find relevant extractions
  const relevantExtractions = extractions.filter((e) =>
    proposal.extraction_ids.includes(e.session_id)
  );

  const extractionsText = relevantExtractions
    .map((e) => `[${e.session_id}] ${e.suggested_faq_title}\n${e.suggested_faq_answer}`)
    .join("\n---\n");

  if (proposal.type === "update_answer") {
    // Fetch the existing FAQ section
    const sectionContent = proposal.faq_question_title
      ? sectionsByTitle[proposal.faq_question_title] || "(section non trouvée)"
      : "(pas de titre)";

    const userPrompt = `=== CONTENU ACTUEL FAQ ===
${sectionContent}

=== EXTRACTIONS JUSTIFICATIVES ===
${extractionsText}

=== RAISON ===
${proposal.reason}

Produis la mise à jour :`;

    const result = await callOpus(client, DETAIL_UPDATE_PROMPT, userPrompt);
    const parsed = JSON.parse(result);
    proposal.detail = parsed.changes_summary;
    proposal.before = parsed.before;
    proposal.after = parsed.after;

  } else if (proposal.type === "new_question") {
    const userPrompt = `=== EXTRACTIONS ===
${extractionsText}

=== CONTEXTE ===
Thème suggéré : ${proposal.theme || "à déterminer"}
Raison : ${proposal.reason}

Rédige la nouvelle entrée FAQ :`;

    const result = await callOpus(client, DETAIL_NEW_QUESTION_PROMPT, userPrompt);
    const parsed = JSON.parse(result);
    proposal.faq_question_title = parsed.suggested_title;
    proposal.detail = parsed.suggested_answer;
    proposal.theme = parsed.suggested_theme;

  } else if (proposal.type === "update_article" || proposal.type === "new_article") {
    // Find relevant Circle post
    const circlePost = circlePosts.find((p) =>
      proposal.faq_question_title && p.name.toLowerCase().includes(proposal.faq_question_title.toLowerCase())
    );

    const articleContext = circlePost
      ? `=== ARTICLE CIRCLE ACTUEL ===\nTitre: ${circlePost.name}\nURL: ${circlePost.url}\nContenu: ${circlePost.body_plain_text?.slice(0, 2000) || circlePost.body_html?.slice(0, 2000)}`
      : "=== PAS D'ARTICLE EXISTANT ===";

    const userPrompt = `${articleContext}

=== EXTRACTIONS JUSTIFICATIVES ===
${extractionsText}

=== RAISON ===
${proposal.reason}

Produis la proposition :`;

    const result = await callOpus(client, DETAIL_ARTICLE_PROMPT, userPrompt);
    const parsed = JSON.parse(result);
    proposal.detail = `${parsed.diagnostic}\n\n${parsed.proposition}`;

  } else if (proposal.type === "remove_question") {
    // No detail call needed — reason is sufficient
    proposal.detail = proposal.reason;
  }

  return proposal;
}

// ============================================
// HTML BUILDER
// ============================================

function buildProposalHtml(
  proposals: Proposal[],
  meta: { lookbackDays: number; extractionsCount: number; circlePostsCount: number; faqVersion: number }
): string {
  const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const newQuestions = proposals.filter((p) => p.type === "new_question");
  const updateAnswers = proposals.filter((p) => p.type === "update_answer");
  const removeQuestions = proposals.filter((p) => p.type === "remove_question");
  const updateArticles = proposals.filter((p) => p.type === "update_article");
  const newArticles = proposals.filter((p) => p.type === "new_article");

  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Propositions FAQ — ${date}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 24px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { font-size: 20px; margin-top: 40px; color: #2c5282; }
    h3 { font-size: 16px; margin-top: 24px; color: #333; }
    .meta { background: #f7fafc; padding: 16px; border-radius: 8px; margin-bottom: 30px; font-size: 14px; }
    .proposal { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .proposal-header { font-weight: 600; font-size: 15px; margin-bottom: 8px; }
    .reason { color: #666; font-size: 13px; font-style: italic; margin-bottom: 12px; }
    .diff-add { background: #c6f6d5; padding: 2px 4px; border-radius: 2px; }
    .diff-remove { background: #fed7d7; padding: 2px 4px; border-radius: 2px; text-decoration: line-through; }
    .before { background: #fff5f5; padding: 12px; border-radius: 4px; margin: 8px 0; white-space: pre-wrap; font-size: 13px; }
    .after { background: #f0fff4; padding: 12px; border-radius: 4px; margin: 8px 0; white-space: pre-wrap; font-size: 13px; }
    .detail { background: #f7fafc; padding: 12px; border-radius: 4px; margin: 8px 0; white-space: pre-wrap; font-size: 13px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-new { background: #c6f6d5; color: #22543d; }
    .badge-update { background: #bee3f8; color: #2a4365; }
    .badge-remove { background: #fed7d7; color: #742a2a; }
    .badge-article { background: #e9d8fd; color: #44337a; }
    .theme { color: #718096; font-size: 12px; }
    .toc { background: #f7fafc; padding: 16px; border-radius: 8px; margin-bottom: 30px; }
    .toc ul { margin: 4px 0; padding-left: 20px; }
    .toc li { font-size: 13px; margin: 2px 0; }
    .section-count { color: #a0aec0; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Propositions de mise à jour FAQ</h1>

  <div class="meta">
    <strong>Date :</strong> ${date}<br>
    <strong>FAQ de référence :</strong> v${meta.faqVersion}<br>
    <strong>Période analysée :</strong> ${meta.lookbackDays} derniers jours<br>
    <strong>Extractions Crisp analysées :</strong> ${meta.extractionsCount}<br>
    <strong>Articles Circle analysés :</strong> ${meta.circlePostsCount}<br>
    <strong>Total propositions :</strong> ${proposals.length}
  </div>

  <div class="toc">
    <strong>Sommaire</strong>
    <ul>
      <li>Partie 1 — Propositions FAQ
        <ul>
          <li>Nouvelles questions <span class="section-count">(${newQuestions.length})</span></li>
          <li>Réponses à modifier <span class="section-count">(${updateAnswers.length})</span></li>
          <li>Questions à supprimer <span class="section-count">(${removeQuestions.length})</span></li>
        </ul>
      </li>
      <li>Partie 2 — Propositions Articles Circle
        <ul>
          <li>Articles à mettre à jour <span class="section-count">(${updateArticles.length})</span></li>
          <li>Nouveaux articles <span class="section-count">(${newArticles.length})</span></li>
        </ul>
      </li>
    </ul>
  </div>

  <h2>Partie 1 — Propositions FAQ</h2>

  <h3>Nouvelles questions <span class="section-count">(${newQuestions.length})</span></h3>`;

  for (const p of newQuestions) {
    html += `
  <div class="proposal">
    <div class="proposal-header"><span class="badge badge-new">NOUVEAU</span> ${escapeHtml(p.faq_question_title || "Sans titre")}</div>
    ${p.theme ? `<div class="theme">Thème : ${escapeHtml(p.theme)}</div>` : ""}
    <div class="reason">${escapeHtml(p.reason)}</div>
    ${p.detail ? `<div class="detail">${escapeHtml(p.detail)}</div>` : ""}
  </div>`;
  }

  if (newQuestions.length === 0) html += "\n  <p><em>Aucune proposition.</em></p>";

  html += `

  <h3>Réponses à modifier <span class="section-count">(${updateAnswers.length})</span></h3>`;

  for (const p of updateAnswers) {
    html += `
  <div class="proposal">
    <div class="proposal-header"><span class="badge badge-update">MODIFIER</span> ${escapeHtml(p.faq_question_title || "Sans titre")}</div>
    <div class="reason">${escapeHtml(p.reason)}</div>
    ${p.detail ? `<div class="reason">Changements : ${escapeHtml(p.detail)}</div>` : ""}
    ${p.before ? `<div class="before"><strong>Avant :</strong>\n${escapeHtml(p.before)}</div>` : ""}
    ${p.after ? `<div class="after"><strong>Après :</strong>\n${escapeHtml(p.after)}</div>` : ""}
  </div>`;
  }

  if (updateAnswers.length === 0) html += "\n  <p><em>Aucune proposition.</em></p>";

  html += `

  <h3>Questions à supprimer <span class="section-count">(${removeQuestions.length})</span></h3>`;

  for (const p of removeQuestions) {
    html += `
  <div class="proposal">
    <div class="proposal-header"><span class="badge badge-remove">SUPPRIMER</span> ${escapeHtml(p.faq_question_title || "Sans titre")}</div>
    <div class="reason">${escapeHtml(p.reason)}</div>
  </div>`;
  }

  if (removeQuestions.length === 0) html += "\n  <p><em>Aucune proposition.</em></p>";

  html += `

  <h2>Partie 2 — Propositions Articles Circle</h2>

  <h3>Articles à mettre à jour <span class="section-count">(${updateArticles.length})</span></h3>`;

  for (const p of updateArticles) {
    html += `
  <div class="proposal">
    <div class="proposal-header"><span class="badge badge-article">ARTICLE</span> ${escapeHtml(p.faq_question_title || "Sans titre")}</div>
    <div class="reason">${escapeHtml(p.reason)}</div>
    ${p.detail ? `<div class="detail">${escapeHtml(p.detail)}</div>` : ""}
  </div>`;
  }

  if (updateArticles.length === 0) html += "\n  <p><em>Aucune proposition.</em></p>";

  html += `

  <h3>Nouveaux articles à créer <span class="section-count">(${newArticles.length})</span></h3>`;

  for (const p of newArticles) {
    html += `
  <div class="proposal">
    <div class="proposal-header"><span class="badge badge-new">NOUVEAU</span> ${escapeHtml(p.faq_question_title || "Sans titre")}</div>
    ${p.theme ? `<div class="theme">Thème : ${escapeHtml(p.theme)}</div>` : ""}
    <div class="reason">${escapeHtml(p.reason)}</div>
    ${p.detail ? `<div class="detail">${escapeHtml(p.detail)}</div>` : ""}
  </div>`;
  }

  if (newArticles.length === 0) html += "\n  <p><em>Aucune proposition.</em></p>";

  html += `
</body>
</html>`;

  return html;
}

// ============================================
// HELPERS
// ============================================

async function callOpus(client: Anthropic, systemPrompt: string, userPrompt: string): Promise<string> {
  const createMessage = async () => {
    const stream = client.messages.stream({
      model: OPUS_MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const message = await stream.finalMessage();
    return extractJsonText(message);
  };

  try {
    return await createMessage();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`Opus API error, retrying in 5s: ${msg}`);
    await new Promise((r) => setTimeout(r, 5000));
    return await createMessage();
  }
}

function extractJsonText(message: Anthropic.Message): string {
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text");
  }

  let jsonText = textBlock.text.trim();

  // Strip markdown code fences
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Extract JSON from prose if needed
  if (!jsonText.startsWith("[") && !jsonText.startsWith("{")) {
    const firstBracket = jsonText.indexOf("[");
    const firstBrace = jsonText.indexOf("{");
    const start = firstBracket === -1 ? firstBrace : firstBrace === -1 ? firstBracket : Math.min(firstBracket, firstBrace);

    if (start !== -1) {
      const closer = jsonText.startsWith("[", start) ? "]" : "}";
      const end = jsonText.lastIndexOf(closer);
      if (end > start) {
        jsonText = jsonText.slice(start, end + 1);
      }
    }
  }

  return jsonText;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function deduplicateProposals(proposals: Proposal[]): Proposal[] {
  const seen = new Map<string, Proposal>();

  for (const p of proposals) {
    const key = `${p.type}:${(p.faq_question_title || "").toLowerCase().trim()}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, p);
    } else {
      // Merge extraction_ids
      const mergedIds = [...new Set([...existing.extraction_ids, ...p.extraction_ids])];
      seen.set(key, { ...existing, extraction_ids: mergedIds });
    }
  }

  return Array.from(seen.values());
}

async function sendSlackNotification(text: string): Promise<void> {
  const webhookUrl = process.env.script_logs ?? "";
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    logger.error("Failed to send Slack notification", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
