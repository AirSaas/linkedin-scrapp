import { logger, task } from "@trigger.dev/sdk/v3";
import { getSupabase } from "./lib/supabase.js";
import {
  findHubSpotContactByEmail,
  sendCrispMessageToHubSpot,
} from "./lib/hubspot.js";
import { updateCrispMessageHubSpotId } from "./lib/crisp-supabase.js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";
import { createClient } from "@supabase/supabase-js";

// ============================================
// SELF-CHAINING BACKFILL TASK
// ============================================
// Sends Crisp text messages missing hubspot_communication_id to HubSpot.
// Processes BATCH_SIZE messages per run, then self-triggers if more remain.
// Trigger manually from dashboard — no cron.
// ============================================

const BATCH_SIZE = 200;
const BETWEEN_MESSAGES = 200;

function getCrispSupabase() {
  return createClient(
    process.env.TCHAT_SUPPORT_SYNC_SUPABASE_URL!,
    process.env.TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY!
  );
}

export const backfillCrispHubspotTask = task({
  id: "backfill-crisp-hubspot",
  maxDuration: 1800,
  run: async (payload?: { dryRun?: boolean }) => {
    const dryRun = payload?.dryRun ?? false;
    logger.info(`=== START backfill-crisp-hubspot ${dryRun ? "(DRY RUN)" : ""} ===`);

    // 1. Build operator mapping: crisp_operator_id → hubspot_id
    const operatorMap = new Map<string, string>();
    try {
      const { data: team } = await getSupabase()
        .from("workspace_team")
        .select("crisp_operator_id, hubspot_id")
        .not("crisp_operator_id", "is", null);
      for (const row of team ?? []) {
        if (row.crisp_operator_id && row.hubspot_id) {
          operatorMap.set(row.crisp_operator_id, row.hubspot_id);
        }
      }
      logger.info(`Operator mapping: ${operatorMap.size} entries`);
    } catch (err) {
      logger.warn(`Failed to load operator mapping: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. Fetch batch of pending text messages with conversation email
    const sb = getCrispSupabase();
    const { data: messages, error: fetchError } = await sb
      .from("tchat_messages")
      .select(`
        fingerprint,
        session_id,
        content,
        content_type,
        direction,
        sender_type,
        crisp_timestamp,
        raw_data,
        tchat_conversations!inner(contact_email)
      `)
      .is("hubspot_communication_id", null)
      .eq("content_type", "text")
      .not("tchat_conversations.contact_email", "is", null)
      .order("crisp_timestamp", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Failed to fetch messages: ${fetchError.message}`);

    if (!messages || messages.length === 0) {
      logger.info("No pending messages — backfill complete!");
      return { success: true, totalProcessed: 0, totalSent: 0, totalSkipped: 0, errors: 0, done: true };
    }

    logger.info(`Processing batch of ${messages.length} messages`);

    // 3. Cache: email → contactId
    const contactCache = new Map<string, string | null>();
    let totalSent = 0;
    let totalSkipped = 0;
    const errorDetails: TaskError[] = [];

    for (const msg of messages) {
      const email = (msg as any).tchat_conversations?.contact_email as string | null;
      if (!email) {
        totalSkipped++;
        continue;
      }

      try {
        // Resolve contact (cached)
        let contactId = contactCache.get(email);
        if (contactId === undefined) {
          const contact = await findHubSpotContactByEmail(email);
          contactId = contact?.id ?? null;
          contactCache.set(email, contactId);
          await sleep(150);
        }

        if (!contactId) {
          totalSkipped++;
          continue;
        }

        if (dryRun) {
          logger.info(`[DRY RUN] Would send ${msg.fingerprint} (${msg.direction}) for ${email}`);
          totalSent++;
          continue;
        }

        const rawData = msg.raw_data as { user?: { user_id?: string } } | null;
        const hubspotOwnerId = rawData?.user?.user_id
          ? operatorMap.get(rawData.user.user_id) ?? null
          : null;

        const hsCommId = await sendCrispMessageToHubSpot({
          content: msg.content,
          timestamp: msg.crisp_timestamp,
          direction: msg.direction as "INBOUND" | "OUTBOUND",
          contactId,
          hubspotOwnerId,
        });

        if (hsCommId) {
          await updateCrispMessageHubSpotId(msg.fingerprint, hsCommId);
          totalSent++;
        } else {
          totalSkipped++;
        }
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        logger.error(`HubSpot error for ${msg.fingerprint}: ${m}`);
        errorDetails.push({
          type: "HubSpot Backfill",
          code: "exception",
          message: m,
        });
      }

      await sleep(BETWEEN_MESSAGES);
    }

    const noProgress = totalSent === 0;
    const isLastBatch = messages.length < BATCH_SIZE || noProgress;

    const summary = {
      success: true,
      totalProcessed: messages.length,
      totalSent,
      totalSkipped,
      errors: errorDetails.length,
      done: isLastBatch,
      dryRun,
    };

    logger.info("=== SUMMARY ===", summary);

    if (isLastBatch) {
      await sendErrorToScriptLogs("Backfill Crisp → HubSpot", [{
        label: "Messages",
        inserted: totalSent,
        skipped: totalSkipped,
        errors: errorDetails,
      }]);
    }

    // Self-trigger next batch if more messages remain AND we made progress
    if (!dryRun && messages.length >= BATCH_SIZE && !noProgress) {
      logger.info("More messages remain — triggering next batch...");
      await backfillCrispHubspotTask.trigger({});
    } else if (noProgress) {
      logger.info("No messages were sent this batch — stopping to avoid infinite loop.");
    } else {
      logger.info("Backfill complete — no more messages to process.");
    }

    return summary;
  },
});
