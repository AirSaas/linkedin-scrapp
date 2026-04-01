import { schedules, logger } from "@trigger.dev/sdk/v3";
import {
  listConversations,
  getConversationMetas,
  getMessages,
  getRequestCount,
} from "./lib/crisp.js";
import {
  upsertConversation,
  messageExists,
  insertMessage,
  updateConversationCounters,
  updateCrispMessageHubSpotId,
  getCursor,
  updateCursor,
} from "./lib/crisp-supabase.js";
import {
  findHubSpotContactByEmail,
  sendCrispMessageToHubSpot,
} from "./lib/hubspot.js";
import { getSupabase } from "./lib/supabase.js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";

/**
 * CRON : Sync incrémental Crisp → Supabase
 *
 * Stratégie :
 * - Fetch page 1 des conversations (triées par updated_at desc)
 * - Pour chaque conversation updated_at > curseur :
 *   - Fetch les metas + messages récents
 *   - Insert les nouveaux messages (dédup par fingerprint)
 * - Met à jour le curseur
 *
 * Consommation: ~2-10 req/run en temps normal (horaire)
 * Cron configuré via le dashboard Trigger.dev (toutes les heures)
 */
export const syncCrispToSupabase = schedules.task({
  id: "sync-crisp-to-supabase",
  maxDuration: 300,

  run: async () => {
    const startTime = Date.now();
    const errors: TaskError[] = [];

    try {
      const cursorDate = await getCursor();
      const cursorTs = new Date(cursorDate).getTime();

      logger.info("Sync incrémental Crisp", { cursor: cursorDate });

      let totalNewMessages = 0;
      let totalConversations = 0;
      let hubspotSent = 0;
      let hubspotNoMatch = 0;
      let hubspotSkippedNoEmail = 0;
      let hubspotSkippedNonText = 0;
      const noEmailSessions: string[] = [];
      let latestTimestamp = cursorDate;
      let page = 1;

      // Build operator mapping: crisp_operator_id → hubspot_id
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

      // Cache: email → contactId (avoid redundant HubSpot searches)
      const contactCache = new Map<string, string | null>();

      while (page <= 10) {
        const conversations = await listConversations(page);
        if (!conversations.length) break;

        let foundOlderThanCursor = false;

        for (const convo of conversations) {
          const convoUpdatedAt = convo.updated_at;

          if (convoUpdatedAt <= cursorTs) {
            foundOlderThanCursor = true;
            break;
          }

          const sessionId = convo.session_id;
          totalConversations++;

          try {
            const meta = await getConversationMetas(sessionId);
            await sleep(300);

            await upsertConversation(sessionId, meta, convo);

            const messages = await getMessages(sessionId);
            await sleep(300);

            let newInThisConvo = 0;

            for (const msg of messages) {
              const fingerprint = String(msg.fingerprint);

              const exists = await messageExists(fingerprint);
              if (exists) continue;

              const inserted = await insertMessage(msg, sessionId);
              if (inserted) {
                newInThisConvo++;
                totalNewMessages++;

                // HubSpot sync: only text messages with contact email
                if (msg.type !== "text") {
                  hubspotSkippedNonText++;
                } else if (!meta?.email) {
                  hubspotSkippedNoEmail++;
                } else {
                  try {
                    // Resolve contact (cached)
                    let contactId = contactCache.get(meta.email);
                    if (contactId === undefined) {
                      const contact = await findHubSpotContactByEmail(meta.email);
                      contactId = contact?.id ?? null;
                      contactCache.set(meta.email, contactId);
                      await sleep(150);
                    }

                    if (!contactId) {
                      hubspotNoMatch++;
                    } else {
                      const direction = msg.from === "user" ? "INBOUND" as const : "OUTBOUND" as const;
                      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
                      const hubspotOwnerId = msg.user?.user_id ? operatorMap.get(msg.user.user_id) ?? null : null;

                      const hsCommId = await sendCrispMessageToHubSpot({
                        content,
                        timestamp: new Date(msg.timestamp).toISOString(),
                        direction,
                        contactId,
                        hubspotOwnerId,
                      });

                      if (hsCommId) {
                        await updateCrispMessageHubSpotId(fingerprint, hsCommId);
                        hubspotSent++;
                      }
                    }
                  } catch (err) {
                    const m = err instanceof Error ? err.message : String(err);
                    errors.push({ type: "HubSpot", code: "exception", message: `${sessionId}: ${m}` });
                  }
                }
              }
            }

            if (newInThisConvo > 0) {
              await updateConversationCounters(sessionId);
              logger.info(`  ${sessionId}: +${newInThisConvo} nouveaux msgs`);

              // Track conversations with new messages but no email (for Slack alert)
              if (!meta?.email) {
                noEmailSessions.push(`${sessionId} (${meta?.nickname ?? "unknown"})`);
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push({ type: "Conversation", code: "exception", message: `${sessionId}: ${msg}` });
            logger.error(`Error processing ${sessionId}`, { error: msg });
          }

          const convoDate = new Date(convoUpdatedAt).toISOString();
          if (convoDate > latestTimestamp) {
            latestTimestamp = convoDate;
          }
        }

        if (foundOlderThanCursor || conversations.length < 20) break;
        page++;
      }

      if (latestTimestamp > cursorDate) {
        await updateCursor(latestTimestamp, {
          messagesSynced: totalNewMessages,
          errors: errors.length,
        });
      }

      const hubspotErrors = errors.filter((e) => e.type === "HubSpot");
      const otherErrors = errors.filter((e) => e.type !== "HubSpot");

      await sendErrorToScriptLogs("Sync Crisp → Supabase", [
        {
          label: "Messages",
          inserted: totalNewMessages,
          skipped: 0,
          errors: otherErrors,
        },
        {
          label: "HubSpot",
          inserted: hubspotSent,
          skipped: hubspotNoMatch + hubspotSkippedNoEmail + hubspotSkippedNonText,
          errors: hubspotErrors,
        },
      ]);

      if (noEmailSessions.length > 0) {
        logger.warn(`Conversations sans email (${noEmailSessions.length}): ${noEmailSessions.join(", ")}`);
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      logger.info("Sync terminé", {
        duration: `${duration}s`,
        conversations: totalConversations,
        newMessages: totalNewMessages,
        crispRequests: getRequestCount(),
        newCursor: latestTimestamp,
      });

      return {
        duration,
        conversations: totalConversations,
        newMessages: totalNewMessages,
        crispRequests: getRequestCount(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Fatal error: ${msg}`);
      await sendErrorToScriptLogs("Sync Crisp → Supabase", [{
        label: "Sync",
        inserted: 0,
        skipped: 0,
        errors: [{ type: "Fatal", code: "exception", message: msg }],
      }]);
      throw err;
    }
  },
});
