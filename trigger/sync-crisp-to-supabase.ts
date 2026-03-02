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
  getCursor,
  updateCursor,
} from "./lib/crisp-supabase.js";
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
 * Consommation: ~2-5 req/run en temps normal
 * Cron configuré via le dashboard Trigger.dev
 */
export const syncCrispToSupabase = schedules.task({
  id: "sync-crisp-to-supabase",
  maxDuration: 120,

  run: async () => {
    const startTime = Date.now();
    const errors: TaskError[] = [];

    try {
      const cursorDate = await getCursor();
      const cursorTs = new Date(cursorDate).getTime();

      logger.info("Sync incrémental Crisp", { cursor: cursorDate });

      let totalNewMessages = 0;
      let totalConversations = 0;
      let latestTimestamp = cursorDate;
      let page = 1;

      while (page <= 5) {
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
              }
            }

            if (newInThisConvo > 0) {
              await updateConversationCounters(sessionId);
              logger.info(`  ${sessionId}: +${newInThisConvo} nouveaux msgs`);
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

      await sendErrorToScriptLogs("Sync Crisp → Supabase", [{
        label: "Messages",
        inserted: totalNewMessages,
        skipped: 0,
        errors,
      }]);

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
