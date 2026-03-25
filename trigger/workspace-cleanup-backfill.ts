import { logger, task } from "@trigger.dev/sdk/v3";
import {
  ACTIVITY_TYPES,
  COMMUNICATION_TYPE_ID,
  WORKSPACE_TYPE_ID,
  type AssociationPair,
  batchCheckExistingAssociations,
  batchCreateAssociations,
  batchDeleteAssociations,
  batchFetchContactEmails,
  batchGetActivityContacts,
  batchReadAssociations,
  filterExternalContacts,
  getAllAssociatedIds,
  sendWorkspaceSlackNotification,
} from "./lib/hubspot-workspace.js";
import {
  sendErrorToScriptLogs,
  type TaskError,
} from "./lib/utils.js";

// ============================================
// All object types to process (activities + communications)
// ============================================

const ALL_OBJECT_TYPES: Record<string, string> = {
  ...ACTIVITY_TYPES,
  communications: COMMUNICATION_TYPE_ID,
};

const CONTACT_TYPE_ID = "0-1";

// ============================================
// CLEANUP TASK
// ============================================

export const workspaceCleanup = task({
  id: "workspace-cleanup",
  maxDuration: 900,
  run: async (payload: { workspaceIds: string[] }) => {
    const { workspaceIds } = payload;
    logger.info(`=== START workspace-cleanup === ${workspaceIds.length} workspaces`);

    const errors: TaskError[] = [];
    let totalDeleted = 0;

    for (const wsId of workspaceIds) {
      logger.info(`Cleaning workspace ${wsId}...`);

      for (const [slug, typeId] of Object.entries(ALL_OBJECT_TYPES)) {
        try {
          // Get all activity IDs associated with this workspace
          const activityIds = await getAllAssociatedIds(
            WORKSPACE_TYPE_ID,
            wsId,
            typeId
          );

          if (activityIds.length === 0) continue;

          logger.info(`  ${slug}: ${activityIds.length} associations to delete`);

          const pairs: AssociationPair[] = activityIds.map((id) => ({
            fromId: id,
            toId: wsId,
          }));

          const deleted = await batchDeleteAssociations(typeId, pairs);
          totalDeleted += deleted;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Cleanup ${slug} for ws ${wsId} failed: ${msg}`);
          errors.push({
            type: `Cleanup ${slug}`,
            code: "exception",
            message: msg,
            profile: `workspace:${wsId}`,
          });
        }
      }
    }

    logger.info("=== CLEANUP SUMMARY ===", {
      workspaces: workspaceIds.length,
      totalDeleted,
      errors: errors.length,
    });

    await sendErrorToScriptLogs("Workspace Cleanup", [
      { label: "Cleanup", inserted: totalDeleted, skipped: 0, errors },
    ]);

    const slackMsg = `[Workspace Cleanup — Trigger.dev] ${errors.length > 0 ? "⚠️" : "✅"} ${workspaceIds.length} workspaces — ${totalDeleted} associations supprimées${errors.length > 0 ? ` — ${errors.length} erreurs` : ""}`;
    await sendWorkspaceSlackNotification(slackMsg);

    return { success: true, totalDeleted, errors: errors.length };
  },
});

// ============================================
// BACKFILL TASK
// ============================================

export const workspaceBackfill = task({
  id: "workspace-backfill",
  maxDuration: 900,
  run: async (payload: { workspaceIds: string[] }) => {
    const { workspaceIds } = payload;
    logger.info(`=== START workspace-backfill === ${workspaceIds.length} workspaces`);

    const errors: TaskError[] = [];
    let totalCreated = 0;
    let totalAlready = 0;

    for (const wsId of workspaceIds) {
      logger.info(`Backfilling workspace ${wsId}...`);

      // 1. Get contacts associated with this workspace
      let contactIds: string[];
      try {
        contactIds = await getAllAssociatedIds(
          WORKSPACE_TYPE_ID,
          wsId,
          CONTACT_TYPE_ID
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Get contacts for ws ${wsId} failed: ${msg}`);
        errors.push({
          type: "Get workspace contacts",
          code: "exception",
          message: msg,
          profile: `workspace:${wsId}`,
        });
        continue;
      }

      if (contactIds.length === 0) {
        logger.info(`  No contacts for workspace ${wsId}`);
        continue;
      }

      // 2. Fetch emails + filter external
      const emailMap = await batchFetchContactEmails(contactIds);
      const externalContacts = filterExternalContacts(emailMap);

      logger.info(
        `  ${contactIds.length} contacts, ${externalContacts.size} external`
      );

      if (externalContacts.size === 0) continue;

      const externalIds = [...externalContacts];

      // 3. For each object type, get activities and create associations
      for (const [slug, typeId] of Object.entries(ALL_OBJECT_TYPES)) {
        try {
          // Batch get activities for all external contacts
          const activityMap = await batchReadAssociations(
            CONTACT_TYPE_ID,
            typeId,
            externalIds
          );

          // Collect unique activity IDs
          const allActivityIds = new Set<string>();
          for (const [, actIds] of activityMap) {
            actIds.forEach((id) => allActivityIds.add(id));
          }

          if (allActivityIds.size === 0) continue;

          // Check existing associations
          const already = await batchCheckExistingAssociations(
            typeId,
            [...allActivityIds],
            wsId
          );
          totalAlready += already.size;

          // Create missing
          const toCreate: AssociationPair[] = [...allActivityIds]
            .filter((id) => !already.has(id))
            .map((id) => ({ fromId: id, toId: wsId }));

          if (toCreate.length > 0) {
            const created = await batchCreateAssociations(typeId, toCreate);
            totalCreated += created;
            logger.info(
              `  ${slug}: ${created} created, ${already.size} already`
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`Backfill ${slug} for ws ${wsId} failed: ${msg}`);
          errors.push({
            type: `Backfill ${slug}`,
            code: "exception",
            message: msg,
            profile: `workspace:${wsId}`,
          });
        }
      }
    }

    logger.info("=== BACKFILL SUMMARY ===", {
      workspaces: workspaceIds.length,
      totalCreated,
      totalAlready,
      errors: errors.length,
    });

    await sendErrorToScriptLogs("Workspace Backfill", [
      { label: "Backfill", inserted: totalCreated, skipped: totalAlready, errors },
    ]);

    const slackMsg = `[Workspace Backfill — Trigger.dev] ${errors.length > 0 ? "⚠️" : "✅"} ${workspaceIds.length} workspaces — ${totalCreated} créées | ${totalAlready} déjà liées${errors.length > 0 ? ` — ${errors.length} erreurs` : ""}`;
    await sendWorkspaceSlackNotification(slackMsg);

    return { success: true, totalCreated, totalAlready, errors: errors.length };
  },
});

// ============================================
// CLEANUP + BACKFILL COMBO
// ============================================

export const workspaceCleanupAndBackfill = task({
  id: "workspace-cleanup-and-backfill",
  maxDuration: 1800, // 30 min for both
  run: async (payload: { workspaceIds: string[] }) => {
    logger.info(
      `=== START workspace-cleanup-and-backfill === ${payload.workspaceIds.length} workspaces`
    );

    logger.info("======== STEP 1/2: CLEANUP ========");
    const cleanupResult = await workspaceCleanup.triggerAndWait(payload);

    logger.info("======== STEP 2/2: BACKFILL ========");
    const backfillResult = await workspaceBackfill.triggerAndWait(payload);

    logger.info("=== DONE cleanup-and-backfill ===");
    return { cleanup: cleanupResult, backfill: backfillResult };
  },
});
