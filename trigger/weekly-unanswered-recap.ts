import { logger, schedules } from "@trigger.dev/sdk/v3";
import Anthropic from "@anthropic-ai/sdk";
import { sleep, sendErrorToScriptLogs, type TaskError, type TaskResultGroup } from "./lib/utils.js";
import { supabase } from "./lib/supabase.js";
import { unipile } from "./lib/unipile.js";

// ============================================
// CONFIGURATION
// ============================================

const HUBSPOT_API_BASE = "https://api.hubapi.com";

/** Gmail categories to exclude (auto-classified by Gmail as noise) */
const EXCLUDED_GMAIL_CATEGORIES = new Set([
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
]);

/** Sender domains to exclude before AI classification */
const EXCLUDED_SENDER_DOMAINS = new Set([
  "airsaas.io",       // internal team
  "whimsical.com",    // collaboration tool notifications
  "qonto.com",        // banking notifications
  "notion.so",        // collaboration tool notifications
  "linear.app",       // project management notifications
  "figma.com",        // design tool notifications
  "github.com",       // code platform notifications
  "slack.com",        // messaging platform notifications
]);

const RATE_LIMIT = {
  UNIPILE: 500,
  ANTHROPIC: 2000,
  HUBSPOT: 150,
  HUBSPOT_429_PAUSE: 10000,
};

const AI_BATCH_SIZE = 10;
const MAX_MESSAGES_FOR_AI = 10;

/**
 * People with email (Gmail) connected to Unipile.
 * Add more entries here when other team members connect their Gmail.
 */
const EMAIL_RECAP_ACCOUNTS = [
  {
    name: "Bertran Ruiz",
    ghost_genius_id: "77afde07-9ff8-4a78-a067-e8357a99a843",
    unipile_email_account_id: "wQaPpLN6S9uMUkyidP9RyQ",
    email: "bertran@airsaas.io",
  },
];

// ============================================
// TYPES
// ============================================

interface TeamMember {
  linkedin_urn: string;
  unipile_account_id: string;
  firstname: string;
  lastname: string;
  ghost_genius_account_id: string;
}

interface UnansweredItem {
  id: string;
  source: "linkedin" | "email";
  teamMemberName: string;
  teamMemberKey: string; // ghost_genius_id or account key for grouping
  senderName: string;
  senderEmail?: string;
  senderLinkedInUrl?: string;
  subject?: string;
  preview: string;
  messages: { from: string; text: string }[];
}

interface ClassifiedItem extends UnansweredItem {
  classification: "important" | "spam";
  summary: string;
}

interface UnipileEmail {
  id: string;
  date: string;
  thread_id: string;
  subject: string;
  body_plain: string;
  from_attendee: { display_name: string; identifier: string };
  to_attendees: { display_name: string; identifier: string }[];
  folders: string[];
  role: string;
  in_reply_to?: { message_id: string; id: string };
}

interface UnipileEmailList {
  items: UnipileEmail[];
  cursor: string | null;
}

// ============================================
// SCHEDULED TASK
// ============================================
export const weeklyUnansweredRecapTask = schedules.task({
  id: "weekly-unanswered-recap",
  maxDuration: 300,
  run: async () => {
    logger.info("=== START weekly-unanswered-recap ===");
    const errors: TaskError[] = [];

    try {
      // Step 1 — Calculate week boundaries (Europe/Paris)
      const { mondayISO, fridayISO, weekLabel } = getWeekBounds();
      logger.info(`Week: ${weekLabel} (${mondayISO} → ${fridayISO})`);

      // Step 2 — Fetch team members
      const team = await fetchTeamMembers();
      logger.info(`${team.length} team members found`);

      // Step 3 — LinkedIn unanswered messages (all team members from Supabase)
      const linkedinItems: UnansweredItem[] = [];
      for (const member of team) {
        try {
          const items = await getLinkedInUnanswered(member, mondayISO, fridayISO);
          linkedinItems.push(...items);
          logger.info(`${member.firstname} ${member.lastname}: ${items.length} LinkedIn unanswered`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`LinkedIn error for ${member.firstname}: ${msg}`);
          errors.push({ type: "LinkedIn", code: "exception", message: `${member.firstname}: ${msg}` });
        }
        await sleep(RATE_LIMIT.HUBSPOT); // small pause between members
      }

      // Step 4 — Email unanswered (EMAIL_RECAP_ACCOUNTS only)
      const emailItems: UnansweredItem[] = [];
      for (const account of EMAIL_RECAP_ACCOUNTS) {
        try {
          const items = await getEmailUnanswered(account, mondayISO, fridayISO);
          emailItems.push(...items);
          logger.info(`${account.name}: ${items.length} email unanswered`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Email error for ${account.name}: ${msg}`);
          errors.push({ type: "Email", code: "exception", message: `${account.name}: ${msg}` });
        }
      }

      const allItems = [...linkedinItems, ...emailItems];
      logger.info(`Total unanswered before AI: ${allItems.length} (${linkedinItems.length} LinkedIn, ${emailItems.length} email)`);

      if (allItems.length === 0) {
        await sendSlackRecap(weekLabel, [], 0);
        logger.info("No unanswered messages, sent empty recap");
        return { success: true, total: 0, important: 0, filtered: 0 };
      }

      // Step 5 — AI classification (Claude Sonnet)
      const classified = await classifyWithAI(allItems, errors);
      const important = classified.filter((c) => c.classification === "important");
      const filtered = classified.filter((c) => c.classification === "spam");
      logger.info(`AI: ${important.length} important, ${filtered.length} filtered`);

      // Step 6 — LinkedIn lookup for email senders
      for (const item of important) {
        if (item.source === "email" && item.senderEmail && !item.senderLinkedInUrl) {
          try {
            const linkedinUrl = await lookupLinkedInByEmail(item.senderEmail);
            if (linkedinUrl) item.senderLinkedInUrl = linkedinUrl;
          } catch {
            // non-critical, just skip
          }
          await sleep(RATE_LIMIT.HUBSPOT);
        }
      }

      // Step 7 — Post Slack recap
      await sendSlackRecap(weekLabel, important, filtered.length);

      // Error reporting
      if (errors.length > 0) {
        await sendErrorToScriptLogs("Weekly Unanswered Recap", [{
          label: "Exécution",
          inserted: important.length,
          skipped: filtered.length,
          errors,
        }]);
      }

      const summary = {
        success: true,
        total: allItems.length,
        important: important.length,
        filtered: filtered.length,
      };
      logger.info("=== SUMMARY ===", summary);
      return summary;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Fatal error: ${msg}`);
      await sendErrorToScriptLogs("Weekly Unanswered Recap", [{
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
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const todayUTC = new Date(Date.UTC(year, month - 1, day));
  const mondayUTC = new Date(todayUTC);
  mondayUTC.setUTCDate(mondayUTC.getUTCDate() + diffToMonday);

  const fridayUTC = new Date(mondayUTC);
  fridayUTC.setUTCDate(fridayUTC.getUTCDate() + 4);

  const pad = (n: number) => String(n).padStart(2, "0");
  const mondayISO = `${mondayUTC.getUTCFullYear()}-${pad(mondayUTC.getUTCMonth() + 1)}-${pad(mondayUTC.getUTCDate())}T00:00:00.000Z`;
  const fridayISO = `${fridayUTC.getUTCFullYear()}-${pad(fridayUTC.getUTCMonth() + 1)}-${pad(fridayUTC.getUTCDate())}T08:30:00.000Z`;

  const monthNames = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  const weekLabel = `Semaine du ${mondayUTC.getUTCDate()} ${monthNames[mondayUTC.getUTCMonth()]} ${mondayUTC.getUTCFullYear()}`;

  return { mondayISO, fridayISO, weekLabel };
}

// ============================================
// TEAM MEMBERS
// ============================================
async function fetchTeamMembers(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("workspace_team")
    .select("linkedin_urn, unipile_account_id, firstname, lastname, ghost_genius_account_id")
    .not("unipile_account_id", "is", null)
    .not("linkedin_urn", "is", null)
    .neq("linkedin_urn", "");

  if (error) throw new Error(`Supabase workspace_team: ${error.message}`);
  return (data ?? []) as TeamMember[];
}

// ============================================
// LINKEDIN UNANSWERED (from Supabase)
// ============================================
async function getLinkedInUnanswered(
  member: TeamMember,
  mondayISO: string,
  _fridayISO: string
): Promise<UnansweredItem[]> {
  // Fetch 1:1 threads with activity this week
  const { data: threads, error: threadsError } = await supabase
    .from("scrapped_linkedin_threads")
    .select("id, last_activity_at, participants, participant_owner_id, main_participant_id")
    .eq("participant_owner_id", member.linkedin_urn)
    .eq("participants_numbers", 2)
    .gte("last_activity_at", mondayISO)
    .order("last_activity_at", { ascending: false });

  if (threadsError) throw new Error(`Supabase threads: ${threadsError.message}`);
  if (!threads || threads.length === 0) return [];

  const threadIds = threads.map((t: any) => t.id);

  // Fetch all messages from these threads this week
  const { data: messages, error: messagesError } = await supabase
    .from("scrapped_linkedin_messages")
    .select("id, thread_id, sender_id, text, message_date, sender_data")
    .in("thread_id", threadIds)
    .gte("message_date", mondayISO)
    .order("message_date", { ascending: false });

  if (messagesError) throw new Error(`Supabase messages: ${messagesError.message}`);
  if (!messages || messages.length === 0) return [];

  // Group by thread, check if last message is from someone else
  const messagesByThread = new Map<string, any[]>();
  for (const msg of messages) {
    const list = messagesByThread.get(msg.thread_id) ?? [];
    list.push(msg);
    messagesByThread.set(msg.thread_id, list);
  }

  const unanswered: UnansweredItem[] = [];

  for (const thread of threads) {
    const threadMessages = messagesByThread.get(thread.id);
    if (!threadMessages || threadMessages.length === 0) continue;

    // Messages are already sorted DESC by message_date
    const lastMessage = threadMessages[0];
    if (lastMessage.sender_id === member.linkedin_urn) continue; // already replied

    // Get sender info from sender_data
    let senderName = "Inconnu";
    let senderLinkedInUrl: string | undefined;
    try {
      const senderData = typeof lastMessage.sender_data === "string"
        ? JSON.parse(lastMessage.sender_data)
        : lastMessage.sender_data;
      senderName = senderData?.full_name ?? "Inconnu";
      senderLinkedInUrl = senderData?.url ?? undefined;
    } catch {
      // use defaults
    }

    // Build conversation for AI (last N messages, chronological)
    const aiMessages = threadMessages
      .slice(0, MAX_MESSAGES_FOR_AI)
      .reverse()
      .map((m: any) => {
        let fromName = "Inconnu";
        try {
          const sd = typeof m.sender_data === "string" ? JSON.parse(m.sender_data) : m.sender_data;
          fromName = sd?.full_name ?? "Inconnu";
        } catch { /* ignore */ }
        return { from: fromName, text: (m.text ?? "").substring(0, 1000) };
      });

    unanswered.push({
      id: `linkedin_${thread.id}`,
      source: "linkedin",
      teamMemberName: `${member.firstname} ${member.lastname}`,
      teamMemberKey: member.ghost_genius_account_id,
      senderName,
      senderLinkedInUrl,
      preview: (lastMessage.text ?? "").substring(0, 100),
      messages: aiMessages,
    });
  }

  return unanswered;
}

// ============================================
// EMAIL UNANSWERED (from Unipile API)
// ============================================
function isExcludedDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return !!domain && EXCLUDED_SENDER_DOMAINS.has(domain);
}

async function getEmailUnanswered(
  account: typeof EMAIL_RECAP_ACCOUNTS[0],
  mondayISO: string,
  fridayISO: string
): Promise<UnansweredItem[]> {
  // Fetch INBOX emails for the week
  const inboxEmails = await fetchAllEmails(account.unipile_email_account_id, {
    folder: "INBOX",
    after: mondayISO,
    before: fridayISO,
  });
  logger.info(`${account.name}: ${inboxEmails.length} inbox emails fetched`);

  // Fetch SENT emails for the week (to detect replies)
  const sentEmails = await fetchAllEmails(account.unipile_email_account_id, {
    folder: "SENT",
    after: mondayISO,
    before: fridayISO,
  });
  logger.info(`${account.name}: ${sentEmails.length} sent emails fetched`);

  // Set of thread_ids where we've sent a reply
  const repliedThreadIds = new Set(sentEmails.map((e) => e.thread_id));

  // Group inbox emails by thread, applying pre-filters
  const emailsByThread = new Map<string, UnipileEmail[]>();

  for (const email of inboxEmails) {
    // Exclude Gmail auto-categories
    if (email.folders.some((f) => EXCLUDED_GMAIL_CATEGORIES.has(f))) continue;

    // Exclude threads we've already replied to
    if (repliedThreadIds.has(email.thread_id)) continue;

    // Exclude sender domains (internal team, notification platforms)
    if (isExcludedDomain(email.from_attendee.identifier)) continue;

    const list = emailsByThread.get(email.thread_id) ?? [];
    list.push(email);
    emailsByThread.set(email.thread_id, list);
  }

  // Convert to UnansweredItem — one per thread, with all non-excluded senders visible
  const items: UnansweredItem[] = [];
  for (const [threadId, threadEmails] of emailsByThread) {
    // Sort chronologically, take last N for AI
    const sorted = threadEmails
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const aiSlice = sorted.slice(-MAX_MESSAGES_FOR_AI);

    const aiMessages = aiSlice.map((e) => ({
      from: e.from_attendee.display_name || e.from_attendee.identifier,
      text: (e.body_plain || e.subject || "").substring(0, 1000),
    }));

    // Use the latest email for sender info display
    const latest = sorted[sorted.length - 1];

    items.push({
      id: `email_${threadId}`,
      source: "email",
      teamMemberName: account.name,
      teamMemberKey: account.ghost_genius_id,
      senderName: latest.from_attendee.display_name || latest.from_attendee.identifier,
      senderEmail: latest.from_attendee.identifier,
      subject: latest.subject,
      preview: (latest.body_plain || latest.subject || "").substring(0, 100),
      messages: aiMessages,
    });
  }

  return items;
}

async function fetchAllEmails(
  accountId: string,
  options: { folder: string; after: string; before: string }
): Promise<UnipileEmail[]> {
  const allEmails: UnipileEmail[] = [];
  let cursor: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 20;

  // Unipile requires ISO 8601 with milliseconds: YYYY-MM-DDTHH:MM:SS.sssZ
  const afterMs = options.after.includes(".") ? options.after : options.after.replace("Z", ".000Z");
  const beforeMs = options.before.includes(".") ? options.before : options.before.replace("Z", ".000Z");

  do {
    const result = (await unipile.getEmails(accountId, {
      limit: 100,
      folder: options.folder,
      after: afterMs,
      before: beforeMs,
      cursor,
    })) as UnipileEmailList;

    allEmails.push(...result.items);
    cursor = result.cursor ?? undefined;
    pageCount++;

    if (cursor) await sleep(RATE_LIMIT.UNIPILE);
  } while (cursor && pageCount < MAX_PAGES);

  return allEmails;
}

// ============================================
// AI CLASSIFICATION (Claude Sonnet)
// ============================================

const CLASSIFICATION_SYSTEM_PROMPT = `Tu es un assistant qui trie les messages professionnels non répondus pour une équipe commerciale SaaS B2B (Airsaas).

Classifie chaque conversation :
- "important" : un vrai interlocuteur humain attend une réponse (prospect, client, partenaire, collègue externe hors Airsaas, candidat, introduction, question, demande de meeting)
- "spam" : bruit qui ne nécessite pas de réponse :
  • Newsletters, notifications automatiques de plateformes SaaS (Whimsical, Notion, Linear, Figma, GitHub, Jira, Vercel, Slack, etc.)
  • Emails transactionnels bancaires/financiers (Qonto, Stripe, PayPal, etc.)
  • Messages commerciaux non sollicités, InMail promo LinkedIn
  • Endorsements, anniversaires de travail LinkedIn, invitations événement génériques
  • Tout email dont l'expéditeur est une adresse "noreply@", "notifications@", "support@" d'un outil SaaS

En cas de doute → "important" (faux positifs préférables à des messages manqués).

Réponds UNIQUEMENT en JSON valide, sans markdown ni backticks :
[{ "id": "identifiant", "classification": "important", "summary": "résumé en 10 mots max du sujet" }]`;

async function classifyWithAI(
  items: UnansweredItem[],
  errors: TaskError[]
): Promise<ClassifiedItem[]> {
  const results: ClassifiedItem[] = [];

  // Process in batches
  for (let i = 0; i < items.length; i += AI_BATCH_SIZE) {
    const batch = items.slice(i, i + AI_BATCH_SIZE);

    try {
      const classified = await classifyBatch(batch);
      results.push(...classified);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`AI classification error batch ${i}: ${msg}`);
      errors.push({ type: "AI Classification", code: "exception", message: msg });

      // Fallback: mark all as important (safe default)
      for (const item of batch) {
        results.push({
          ...item,
          classification: "important",
          summary: item.preview.substring(0, 60),
        });
      }
    }

    if (i + AI_BATCH_SIZE < items.length) await sleep(RATE_LIMIT.ANTHROPIC);
  }

  return results;
}

async function classifyBatch(batch: UnansweredItem[]): Promise<ClassifiedItem[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const payload = batch.map((item) => ({
    id: item.id,
    source: item.source,
    sender: item.senderName,
    subject: item.subject ?? null,
    messages: item.messages,
  }));

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Classifie ces ${batch.length} conversations non répondues :\n\n${JSON.stringify(payload, null, 2)}`,
      }],
    });
  } catch (err) {
    // Retry once
    await sleep(2000);
    response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0,
      system: CLASSIFICATION_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Classifie ces ${batch.length} conversations non répondues :\n\n${JSON.stringify(payload, null, 2)}`,
      }],
    });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  const parsed = JSON.parse(textBlock.text) as {
    id: string;
    classification: "important" | "spam";
    summary: string;
  }[];

  // Map classifications back to items
  const classificationMap = new Map(parsed.map((p) => [p.id, p]));

  return batch.map((item) => {
    const cls = classificationMap.get(item.id);
    return {
      ...item,
      classification: cls?.classification ?? "important",
      summary: cls?.summary ?? item.preview.substring(0, 60),
    };
  });
}

// ============================================
// HUBSPOT LINKEDIN LOOKUP
// ============================================
async function lookupLinkedInByEmail(email: string): Promise<string | null> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN ?? "";
  if (!token) return null;

  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filterGroups: [{
        filters: [{
          propertyName: "email",
          operator: "EQ",
          value: email,
        }],
      }],
      properties: ["hs_linkedin_url", "linkedin_url"],
      limit: 1,
    }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const contact = data?.results?.[0]?.properties;
  if (!contact) return null;

  return contact.hs_linkedin_url || contact.linkedin_url || null;
}

// ============================================
// SLACK RECAP (via webhook)
// ============================================
async function sendSlackRecap(
  weekLabel: string,
  important: ClassifiedItem[],
  filteredCount: number
): Promise<void> {
  const webhookUrl = process.env.webhook_unanswered_recap;
  if (!webhookUrl) {
    logger.error("webhook_unanswered_recap not configured");
    return;
  }

  let text = `📬 *Recap messages non répondus — ${weekLabel}*\n`;

  if (important.length === 0) {
    text += `\n✅ Aucun message important non répondu cette semaine !\n`;
    text += `\n📊 ${filteredCount} messages filtrés (spam/notif)`;
  } else {
    // Group by team member
    const byMember = new Map<string, ClassifiedItem[]>();
    for (const item of important) {
      const list = byMember.get(item.teamMemberName) ?? [];
      list.push(item);
      byMember.set(item.teamMemberName, list);
    }

    for (const [memberName, items] of byMember) {
      text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n👤 *${memberName}*\n`;

      const linkedinItems = items.filter((i) => i.source === "linkedin");
      const emailItems = items.filter((i) => i.source === "email");

      if (linkedinItems.length > 0) {
        text += `\n💬 *LinkedIn (${linkedinItems.length})*\n`;
        for (const item of linkedinItems) {
          text += `• *${item.senderName}* — ${item.summary}`;
          if (item.senderLinkedInUrl) {
            text += `\n  <${item.senderLinkedInUrl}|Profil LinkedIn>`;
          }
          text += "\n";
        }
      }

      if (emailItems.length > 0) {
        text += `\n📧 *Email (${emailItems.length})*\n`;
        for (const item of emailItems) {
          const emailDisplay = item.senderEmail ? ` (${item.senderEmail})` : "";
          text += `• *${item.senderName}*${emailDisplay} — ${item.summary}`;
          if (item.senderLinkedInUrl) {
            text += `\n  <${item.senderLinkedInUrl}|Profil LinkedIn>`;
          }
          text += "\n";
        }
      }
    }

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━`;
    text += `\n📊 ${important.length} messages importants / ${filteredCount} filtrés (spam/notif) — Classifié par Claude Sonnet`;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      logger.info("Slack recap sent successfully");
    } else {
      const body = await res.text();
      logger.error(`Slack webhook failed: ${res.status} — ${body}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Slack webhook error: ${msg}`);
  }
}
