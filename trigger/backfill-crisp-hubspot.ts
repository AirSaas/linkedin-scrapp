import { logger, task } from "@trigger.dev/sdk/v3";
import { getSupabase } from "./lib/supabase.js";
import {
  findHubSpotContactByEmail,
  sendCrispMessageToHubSpot,
  callHubSpot,
} from "./lib/hubspot.js";
import { updateCrispMessageHubSpotId } from "./lib/crisp-supabase.js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";
import { createClient } from "@supabase/supabase-js";

// ============================================
// SELF-CHAINING BACKFILL TASK
// ============================================
// Sends Crisp text messages missing hubspot_communication_id to HubSpot.
// Processes BATCH_SIZE messages per run, then self-triggers if more remain.
// Messages with no HubSpot contact match are marked SKIPPED_NO_CONTACT
// to avoid re-processing.
// Trigger manually from dashboard — no cron.
// ============================================

const BATCH_SIZE = 200;
const BETWEEN_MESSAGES = 200;
const SKIPPED_NO_CONTACT = "SKIPPED_NO_CONTACT";

function getCrispSupabase() {
  return createClient(
    process.env.TCHAT_SUPPORT_SYNC_SUPABASE_URL!,
    process.env.TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY!
  );
}

export const backfillCrispHubspotTask = task({
  id: "backfill-crisp-hubspot",
  maxDuration: 1800,
  run: async (payload?: { dryRun?: boolean; patchBody?: boolean }) => {
    const dryRun = payload?.dryRun ?? false;
    const patchBody = payload?.patchBody ?? false;
    logger.info(`=== START backfill-crisp-hubspot ${dryRun ? "(DRY RUN)" : ""} ${patchBody ? "(PATCH BODY)" : ""} ===`);

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

    const sb = getCrispSupabase();

    // PATCH MODE: update existing communications body to add [tchat_support] prefix
    if (patchBody) {
      return await patchExistingBodies(sb);
    }

    // 2. Fetch batch of pending text messages with conversation email
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
        await markSkipped(sb, msg.fingerprint);
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
          await markSkipped(sb, msg.fingerprint);
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
          await markSkipped(sb, msg.fingerprint);
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

    const isLastBatch = messages.length < BATCH_SIZE;

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

    // Self-trigger next batch if more messages remain
    if (!dryRun && messages.length >= BATCH_SIZE) {
      logger.info("More messages remain — triggering next batch...");
      await backfillCrispHubspotTask.trigger({});
    } else {
      logger.info("Backfill complete — no more messages to process.");
    }

    return summary;
  },
});

async function markSkipped(
  sb: any,
  fingerprint: string
): Promise<void> {
  const { error } = await sb
    .from("tchat_messages")
    .update({ hubspot_communication_id: SKIPPED_NO_CONTACT })
    .eq("fingerprint", fingerprint);
  if (error) {
    logger.error(`Failed to mark ${fingerprint} as skipped: ${error.message}`);
  }
}

/**
 * Patch existing HubSpot communications to add [tchat_support] prefix.
 * Finds messages with a real hubspot_communication_id (not SKIPPED) whose
 * body doesn't have the prefix yet, and PATCHes them in HubSpot.
 */
async function patchExistingBodies(
  sb: any
): Promise<Record<string, unknown>> {
  const { data: messages, error } = await sb
    .from("tchat_messages")
    .select(`
      fingerprint,
      content,
      direction,
      hubspot_communication_id,
      tchat_conversations!inner(contact_email)
    `)
    .not("hubspot_communication_id", "is", null)
    .neq("hubspot_communication_id", SKIPPED_NO_CONTACT)
    .order("crisp_timestamp", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  if (!messages || messages.length === 0) {
    logger.info("No messages to patch — done!");
    return { success: true, patched: 0, done: true };
  }

  let patched = 0;
  let skipped = 0;
  const errors: TaskError[] = [];

  for (const msg of messages) {
    const hsCommId = msg.hubspot_communication_id as string;
    const directionLabel = msg.direction === "INBOUND" ? "Inbound" : "Outbound";
    const newBody = `[tchat_support] ${directionLabel}: ${msg.content}`;

    try {
      await callHubSpot(
        `https://api.hubapi.com/crm/v3/objects/communications/${hsCommId}`,
        "PATCH",
        { properties: { hs_communication_body: newBody } }
      );
      patched++;
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      // 404 = comm was deleted, skip
      if (m.includes("404")) {
        skipped++;
      } else {
        errors.push({ type: "Patch Body", code: "exception", message: `${hsCommId}: ${m}` });
      }
    }

    await sleep(150);
  }

  const done = messages.length < BATCH_SIZE;
  const summary = { success: true, patched, skipped, errors: errors.length, done };
  logger.info("=== PATCH SUMMARY ===", summary);

  if (!done) {
    logger.info("More messages to patch — triggering next batch...");
    await backfillCrispHubspotTask.trigger({ patchBody: true });
  } else {
    await sendErrorToScriptLogs("Patch Crisp → HubSpot body", [{
      label: "Communications",
      inserted: patched,
      skipped,
      errors,
    }]);
  }

  return summary;
}
