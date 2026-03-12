import { logger, task } from "@trigger.dev/sdk/v3";
import { getSupabase } from "./lib/supabase.js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";
import { sendMessageToHubSpot } from "./lib/hubspot.js";

// ============================================
// SELF-CHAINING BACKFILL TASK
// ============================================
// Sends LinkedIn messages missing hubspot_communication_id to HubSpot.
// Processes BATCH_SIZE messages per run, then self-triggers if more remain.
// Trigger manually from dashboard — no cron.
// ============================================

const BATCH_SIZE = 200;
const BETWEEN_MESSAGES = 200;

export const backfillHubspotMessagesTask = task({
  id: "backfill-hubspot-messages",
  maxDuration: 1800,
  run: async () => {
    logger.info("=== START backfill-hubspot-messages ===");

    // 1. Build HubSpot owners cache
    const { data: teamData, error: teamError } = await getSupabase()
      .from("workspace_team")
      .select("linkedin_urn, hubspot_id")
      .not("hubspot_id", "is", null);

    if (teamError) throw new Error(`Failed to fetch team: ${teamError.message}`);

    const hubspotOwners = new Map<string, string>();
    for (const row of teamData ?? []) {
      hubspotOwners.set(row.linkedin_urn, row.hubspot_id);
    }
    logger.info(`Cached ${hubspotOwners.size} HubSpot owners`);

    // 2. Fetch batch of pending messages
    const { data: messages, error: fetchError } = await getSupabase()
      .from("scrapped_linkedin_messages")
      .select("id, thread_id, message_date, text, sender_id, participant_owner_id, participants_numbers, main_participant_id")
      .is("hubspot_communication_id", null)
      .eq("participants_numbers", 2)
      .not("main_participant_id", "is", null)
      .order("message_date", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw new Error(`Failed to fetch messages: ${fetchError.message}`);

    if (!messages || messages.length === 0) {
      logger.info("No pending messages — backfill complete!");
      return { success: true, totalProcessed: 0, totalSent: 0, totalSkipped: 0, errors: 0, done: true };
    }

    logger.info(`Processing batch of ${messages.length} messages`);

    let totalSent = 0;
    let totalSkipped = 0;
    const errorDetails: TaskError[] = [];

    // 3. Process each message
    for (const msg of messages) {
      try {
        const hsCommId = await sendMessageToHubSpot(
          msg as Record<string, unknown>,
          hubspotOwners
        );

        if (hsCommId) {
          const { error: updateError } = await getSupabase()
            .from("scrapped_linkedin_messages")
            .update({ hubspot_communication_id: hsCommId })
            .eq("id", msg.id);

          if (updateError) {
            logger.error(`Failed to update hubspot_communication_id for ${msg.id}: ${updateError.message}`);
          }
          totalSent++;
        } else {
          totalSkipped++;
        }
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        logger.error(`HubSpot error for ${msg.id}: ${m}`);
        errorDetails.push({
          type: "HubSpot Backfill",
          code: "exception",
          message: m,
          profile: msg.id,
        });
      }

      await sleep(BETWEEN_MESSAGES);
    }

    // 4. Send recap to Slack
    await sendErrorToScriptLogs("Backfill HubSpot Messages", [{
      label: "Messages",
      inserted: totalSent,
      skipped: totalSkipped,
      errors: errorDetails,
    }]);

    const summary = {
      success: true,
      totalProcessed: messages.length,
      totalSent,
      totalSkipped,
      errors: errorDetails.length,
      done: messages.length < BATCH_SIZE,
    };

    logger.info("=== SUMMARY ===", summary);

    // 5. Self-trigger next batch if more messages remain
    if (messages.length >= BATCH_SIZE) {
      logger.info("More messages remain — triggering next batch...");
      await backfillHubspotMessagesTask.trigger();
    } else {
      logger.info("Backfill complete — no more messages to process.");
    }

    return summary;
  },
});
