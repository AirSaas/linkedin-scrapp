import { schedules, logger } from "@trigger.dev/sdk/v3";
import {
  listConversations,
  getConversationMetas,
  getAllMessages,
  getRequestCount,
  isRateLimited,
  resetRequestCount,
} from "./lib/crisp.js";
import {
  upsertConversation,
  insertMessagesBatch,
  updateConversationCounters,
  classifyConversations,
  getSyncStats,
  getBatchCursor,
  updateBatchCursor,
} from "./lib/crisp-supabase.js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";

const MIN_GAP_HOURS = 25;
const MAX_REQUESTS = 400; // Marge pour le sync horaire (qui consomme aussi des req Crisp)

/**
 * DAILY BATCH : Import historique Crisp → Supabase (automatique)
 *
 * Cron toutes les heures, mais exécution réelle uniquement si 25h+ depuis le dernier run.
 * Ce décalage naturel d'1h/jour évite de retomber dans la fenêtre de rate limit Crisp (500 req/24h glissantes).
 *
 * Le curseur (next_page) est stocké dans tchat_batch_cursor_tmp (table temporaire, à supprimer
 * une fois l'import historique terminé).
 *
 * Quand 3 pages vides consécutives → marque is_done = true, les prochains runs ne font rien.
 */
export const dailyBatchCrispToSupabase = schedules.task({
  id: "daily-batch-crisp-to-supabase",
  cron: "0 * * * *",
  maxDuration: 600,

  run: async () => {
    resetRequestCount();
    const cursor = await getBatchCursor();

    // Déjà terminé ?
    if (cursor.isDone) {
      logger.info("Import historique terminé (is_done=true), skip");
      return { skipped: true, reason: "done" };
    }

    // Vérifier le gap de 25h
    if (cursor.lastRunAt) {
      const hoursSinceLastRun =
        (Date.now() - new Date(cursor.lastRunAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRun < MIN_GAP_HOURS) {
        logger.info(`Dernier run il y a ${hoursSinceLastRun.toFixed(1)}h (< ${MIN_GAP_HOURS}h), skip`);
        return { skipped: true, reason: "too_soon", hoursSinceLastRun: Math.round(hoursSinceLastRun * 10) / 10 };
      }
    }

    // --- Exécution réelle ---
    const startPage = cursor.nextPage;
    logger.info("Daily batch Crisp → Supabase", { startPage });

    const errors: TaskError[] = [];
    let totalNew = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;
    let totalMessages = 0;
    let lastPageProcessed = startPage - 1;
    let emptyPages = 0;
    let page = startPage;
    let isDone = false;

    try {
      while (page < startPage + 50) {
        if (isRateLimited() || getRequestCount() >= MAX_REQUESTS) {
          logger.warn("Rate limit proche, arrêt", {
            requests: getRequestCount(),
            lastPage: lastPageProcessed,
          });
          break;
        }

        const conversations = await listConversations(page);

        if (!conversations.length) {
          emptyPages++;
          if (emptyPages >= 3) {
            logger.info("3 pages vides consécutives, import historique terminé");
            isDone = true;
            break;
          }
          page++;
          lastPageProcessed = page - 1;
          continue;
        }
        emptyPages = 0;

        const status = await classifyConversations(conversations);
        totalUnchanged += status.unchangedCount;

        logger.info(
          `Page ${page}: ${status.newSessionIds.size} new, ${status.updatedSessionIds.size} updated, ${status.unchangedCount} unchanged`
        );

        for (const convo of conversations) {
          const sessionId = convo.session_id;
          const isNew = status.newSessionIds.has(sessionId);
          const isUpdatedConvo = status.updatedSessionIds.has(sessionId);

          if (!isNew && !isUpdatedConvo) continue;
          if (isRateLimited() || getRequestCount() >= MAX_REQUESTS) break;

          try {
            if (isNew) {
              const meta = await getConversationMetas(sessionId);
              await sleep(300);

              await upsertConversation(sessionId, meta, convo);

              const messages = await getAllMessages(sessionId);
              await sleep(300);

              if (messages.length) {
                const inserted = await insertMessagesBatch(messages, sessionId);
                totalMessages += inserted;
                await updateConversationCounters(sessionId);
              }

              totalNew++;
            }

            if (isUpdatedConvo) {
              const messages = await getAllMessages(sessionId);
              await sleep(300);

              if (messages.length) {
                const inserted = await insertMessagesBatch(messages, sessionId);
                totalMessages += inserted;
                if (inserted > 0) {
                  await updateConversationCounters(sessionId);
                }
              }

              await upsertConversation(sessionId, null, convo);
              totalUpdated++;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push({ type: "Conversation", code: "exception", message: `${sessionId}: ${msg}` });
            logger.error(`Error processing ${sessionId}`, { error: msg });
          }
        }

        lastPageProcessed = page;
        page++;
      }

      // Sauvegarder le curseur
      const nextPage = isDone ? lastPageProcessed + 1 : lastPageProcessed + 1;
      await updateBatchCursor(nextPage, isDone);

      const stats = await getSyncStats();

      await sendErrorToScriptLogs("Daily Batch Crisp → Supabase", [{
        label: "Conversations",
        inserted: totalNew + totalUpdated,
        skipped: totalUnchanged,
        errors,
      }]);

      const result = {
        pagesProcessed: lastPageProcessed - startPage + 1,
        lastPageProcessed,
        nextPage,
        isDone,
        newConversations: totalNew,
        updatedConversations: totalUpdated,
        unchangedConversations: totalUnchanged,
        totalMessages,
        crispRequestsUsed: getRequestCount(),
        supabaseStats: stats,
      };

      logger.info("Daily batch terminé", result);
      return result;
    } catch (err) {
      // Sauvegarder le curseur même en cas d'erreur (pour ne pas reprendre de zéro)
      if (lastPageProcessed >= startPage) {
        await updateBatchCursor(lastPageProcessed + 1, false);
      }

      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Fatal error: ${msg}`);
      await sendErrorToScriptLogs("Daily Batch Crisp → Supabase", [{
        label: "Batch",
        inserted: 0,
        skipped: 0,
        errors: [{ type: "Fatal", code: "exception", message: msg }],
      }]);
      throw err;
    }
  },
});
