import { task, logger } from "@trigger.dev/sdk/v3";
import {
  listConversations,
  getConversationMetas,
  getAllMessages,
  getRequestCount,
  isRateLimited,
  CrispApiError,
} from "./lib/crisp.js";
import {
  upsertConversation,
  insertMessagesBatch,
  updateConversationCounters,
  classifyConversations,
  getSyncStats,
} from "./lib/crisp-supabase.js";
import { sleep, sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";

/**
 * BATCH : Import historique Crisp → Supabase
 *
 * Payload:
 * {
 *   "startPage": 1,
 *   "maxPages": 100,
 *   "maxRequests": 450
 * }
 *
 * DÉDUP INTELLIGENTE (3 cas par conversation) :
 *
 * | Cas          | Condition                                | Action                    | Coût Crisp |
 * |--------------|------------------------------------------|---------------------------|------------|
 * | Nouvelle     | Pas dans Supabase                        | Fetch metas + messages    | 2+ req     |
 * | Mise à jour  | updated_at Crisp > updated_at Supabase   | Refetch messages seulement| 1+ req     |
 * | Inchangée    | updated_at identiques                    | Skip total                | 0 req      |
 */
export const batchCrispToSupabase = task({
  id: "batch-crisp-to-supabase",
  maxDuration: 600,

  run: async (payload: {
    startPage?: number;
    maxPages?: number;
    maxRequests?: number;
  }) => {
    const startPage = payload.startPage || 1;
    const maxPages = payload.maxPages || 100;
    const maxRequests = Math.min(payload.maxRequests || 450, 490);

    logger.info("Batch Crisp → Supabase", { startPage, maxPages, maxRequests });

    const errors: TaskError[] = [];
    let totalNew = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;
    let totalMessages = 0;
    let lastPageProcessed = startPage - 1;
    let emptyPages = 0;
    let page = startPage;

    while (page < startPage + maxPages) {
      if (isRateLimited() || getRequestCount() >= maxRequests) {
        logger.warn("Rate limit proche, arrêt", {
          requests: getRequestCount(),
          lastPage: lastPageProcessed,
        });
        break;
      }

      let conversations: Awaited<ReturnType<typeof listConversations>>;
      try {
        conversations = await listConversations(page);
      } catch (err) {
        if (err instanceof CrispApiError) {
          logger.error(`Crisp API error on page ${page}, arrêt du batch`, { error: err.message, statusCode: err.statusCode });
          errors.push({ type: "CrispAPI", code: String(err.statusCode ?? "unknown"), message: err.message });
          break;
        }
        throw err;
      }

      if (!conversations.length) {
        emptyPages++;
        if (emptyPages >= 3) {
          logger.info("3 pages vides consécutives, fin");
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
        const isUpdated = status.updatedSessionIds.has(sessionId);

        if (!isNew && !isUpdated) continue;
        if (isRateLimited() || getRequestCount() >= maxRequests) break;

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
            logger.info(`  NEW ${sessionId}: ${meta?.email || "no email"} | ${messages.length} msgs`);
          }

          if (isUpdated) {
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
            logger.info(`  UPD ${sessionId}: refetch → ${messages.length} msgs`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ type: "Conversation", code: "exception", message: `${sessionId}: ${msg}` });
          logger.error(`Error processing ${sessionId}`, { error: msg });
        }
      }

      lastPageProcessed = page;
      page++;

      if ((page - startPage) % 10 === 0) {
        logger.info(
          `Progress: page ${page}, new: ${totalNew}, updated: ${totalUpdated}, unchanged: ${totalUnchanged}, msgs: ${totalMessages}, reqs: ${getRequestCount()}`
        );
      }
    }

    const stats = await getSyncStats();

    await sendErrorToScriptLogs("Batch Crisp → Supabase", [{
      label: "Conversations",
      inserted: totalNew + totalUpdated,
      skipped: totalUnchanged,
      errors,
    }]);

    const result = {
      pagesProcessed: lastPageProcessed - startPage + 1,
      lastPageProcessed,
      nextPage: lastPageProcessed + 1,
      newConversations: totalNew,
      updatedConversations: totalUpdated,
      unchangedConversations: totalUnchanged,
      totalMessages,
      crispRequestsUsed: getRequestCount(),
      supabaseStats: stats,
    };

    logger.info("Batch terminé", result);
    return result;
  },
});
