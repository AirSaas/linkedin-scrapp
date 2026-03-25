import { logger, schedules } from "@trigger.dev/sdk/v3";
import {
  COMMUNICATION_TYPE_ID,
  type AssociationPair,
  batchCheckExistingAssociations,
  batchCreateAssociations,
  batchFetchContactEmails,
  batchGetContactWorkspaces,
  batchReadAssociations,
  filterExternalContacts,
  searchActivitiesSince,
  sendWorkspaceSlackNotification,
} from "./lib/hubspot-workspace.js";
import {
  sendErrorToScriptLogs,
  type TaskError,
} from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================

const LOOKBACK_HOURS = 5;
const CONTACT_TYPE_ID = "0-1";

// ============================================
// SCHEDULED TASK
// ============================================

export const syncWorkspaceComms = schedules.task({
  id: "sync-workspace-comms",
  maxDuration: 900,
  run: async () => {
    logger.info("=== START sync-workspace-comms ===");

    const sinceMs = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;
    const errors: TaskError[] = [];

    // ====== PHASE 1: Search communications ======
    logger.info("Phase 1: Collecting recent communications...");

    let commIds: string[] = [];
    try {
      commIds = await searchActivitiesSince("communications", sinceMs);
      logger.info(`  ${commIds.length} communications found`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Search communications failed: ${msg}`);
      errors.push({ type: "Search communications", code: "exception", message: msg });
    }

    if (commIds.length === 0) {
      logger.info("No recent communications found, done.");
      return { success: true, created: 0, already: 0, errors: 0 };
    }

    // ====== PHASE 2: Batch get comm→contact associations ======
    logger.info("Phase 2: Resolving comm→contact associations...");

    const allContactIds = new Set<string>();
    const commWithContacts: { id: string; contactIds: string[] }[] = [];

    try {
      const contactMap = await batchReadAssociations(
        COMMUNICATION_TYPE_ID,
        CONTACT_TYPE_ID,
        commIds
      );

      for (const [commId, contactIds] of contactMap) {
        if (contactIds.length > 0) {
          commWithContacts.push({ id: commId, contactIds });
          contactIds.forEach((c) => allContactIds.add(c));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Comm→contact batch failed: ${msg}`);
      errors.push({ type: "Assoc comm→contacts", code: "exception", message: msg });
    }

    logger.info(
      `  ${commWithContacts.length} comms with contacts, ${allContactIds.size} unique contacts`
    );

    if (commWithContacts.length === 0) {
      logger.info("No communications with contacts, done.");
      return { success: true, created: 0, already: 0, errors: 0 };
    }

    // ====== PHASE 3: Batch fetch emails + filter external ======
    logger.info("Phase 3: Fetching contact emails & filtering...");

    const emailMap = await batchFetchContactEmails([...allContactIds]);
    const externalContacts = filterExternalContacts(emailMap);
    const internalCount = allContactIds.size - externalContacts.size;

    logger.info(
      `  ${externalContacts.size} external, ${internalCount} internal excluded`
    );

    // ====== PHASE 4: Batch resolve contact→workspace ======
    logger.info("Phase 4: Resolving contact→workspace...");

    const contactWorkspaces = await batchGetContactWorkspaces([
      ...externalContacts,
    ]);

    // ====== PHASE 5: Build association pairs ======
    logger.info("Phase 5: Building association pairs...");

    // Group by workspaceId → commIds
    const groups = new Map<string, Set<string>>();

    for (const comm of commWithContacts) {
      for (const contactId of comm.contactIds) {
        if (!externalContacts.has(contactId)) continue;

        const wsIds = contactWorkspaces.get(contactId) ?? [];
        for (const wsId of wsIds) {
          if (!groups.has(wsId)) groups.set(wsId, new Set());
          groups.get(wsId)!.add(comm.id);
        }
      }
    }

    // ====== PHASE 6: Check existing + create missing ======
    logger.info("Phase 6: Creating associations...");

    let totalCreated = 0;
    let totalAlready = 0;
    let totalTried = 0;

    for (const [workspaceId, commIdSet] of groups) {
      const ids = [...commIdSet];
      totalTried += ids.length;

      try {
        const already = await batchCheckExistingAssociations(
          COMMUNICATION_TYPE_ID,
          ids,
          workspaceId
        );
        totalAlready += already.size;

        const toCreate: AssociationPair[] = ids
          .filter((id) => !already.has(id))
          .map((id) => ({ fromId: id, toId: workspaceId }));

        if (toCreate.length > 0) {
          const created = await batchCreateAssociations(
            COMMUNICATION_TYPE_ID,
            toCreate
          );
          totalCreated += created;
          logger.info(
            `  ws ${workspaceId}: ${created} created, ${already.size} already`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Association ws ${workspaceId} failed: ${msg}`);
        errors.push({
          type: "Assoc comm→ws",
          code: "exception",
          message: msg,
          profile: `workspace:${workspaceId}`,
        });
      }
    }

    // ====== RECAP ======
    logger.info("=== SUMMARY ===", {
      totalTried,
      totalCreated,
      totalAlready,
      commsWithContacts: commWithContacts.length,
      uniqueContacts: allContactIds.size,
      externalContacts: externalContacts.size,
      errors: errors.length,
    });

    const now = new Date();
    const dateFr = `${now.getDate()} ${["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"][now.getMonth()]} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const slackMsg = [
      `[Sync Workspace Comms — Trigger.dev] ${errors.length > 0 ? "⚠️ Erreurs" : "✅ OK"} — ${dateFr} — Période: ${LOOKBACK_HOURS} dernières heures`,
      "",
      "📊 Résultats",
      `- Associations: ${totalCreated} créées | ${totalAlready} déjà liées | ${totalTried} total`,
      `- Contacts: ${internalCount} internes exclus sur ${allContactIds.size} vérifiés`,
      errors.length > 0 ? `\n❌ Erreurs (${errors.length})\n${errors.map((e) => `- ${e.type} (${e.code}) — "${e.message.substring(0, 40)}"`).join("\n")}` : "",
    ].join("\n");

    await sendWorkspaceSlackNotification(slackMsg);

    await sendErrorToScriptLogs("Sync Workspace Comms", [
      {
        label: "Associations",
        inserted: totalCreated,
        skipped: totalAlready,
        errors,
      },
    ]);

    return { success: true, totalCreated, totalAlready, totalTried, errors: errors.length };
  },
});
