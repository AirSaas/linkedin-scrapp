import { logger, schedules } from "@trigger.dev/sdk/v3";
import {
  ACTIVITY_TYPES,
  type ActivityRecord,
  type AssociationPair,
  batchCheckExistingAssociations,
  batchCreateAssociations,
  batchFetchContactEmails,
  batchGetActivityContacts,
  batchGetContactWorkspaces,
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

// ============================================
// SCHEDULED TASK
// ============================================

export const syncWorkspaceActivities = schedules.task({
  id: "sync-workspace-activities",
  maxDuration: 900, // 15 min
  run: async () => {
    logger.info("=== START sync-workspace-activities ===");

    const sinceMs = Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000;
    const errors: TaskError[] = [];

    // ====== PHASE 1: Search activities (5 types) ======
    logger.info("Phase 1: Collecting recent activities...");

    const allActivities: ActivityRecord[] = [];
    const allActivityIdsByType = new Map<string, string[]>();

    for (const [slug, typeId] of Object.entries(ACTIVITY_TYPES)) {
      try {
        const ids = await searchActivitiesSince(slug, sinceMs);
        logger.info(`  ${slug}: ${ids.length} activities found`);

        if (ids.length > 0) {
          allActivityIdsByType.set(typeId, ids);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Search ${slug} failed: ${msg}`);
        errors.push({ type: `Search ${slug}`, code: "exception", message: msg });
      }
    }

    // ====== PHASE 2: Batch get activity→contact associations ======
    logger.info("Phase 2: Resolving activity→contact associations...");

    const allContactIds = new Set<string>();

    for (const [typeId, activityIds] of allActivityIdsByType) {
      try {
        const contactMap = await batchGetActivityContacts(typeId, activityIds);

        for (const [actId, contactIds] of contactMap) {
          if (contactIds.length > 0) {
            allActivities.push({ id: actId, typeId, contactIds });
            contactIds.forEach((c) => allContactIds.add(c));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Activity→contact batch failed (${typeId}): ${msg}`);
        errors.push({
          type: `Assoc ${typeId}→contacts`,
          code: "exception",
          message: msg,
        });
      }
    }

    logger.info(
      `  ${allActivities.length} activities with contacts, ${allContactIds.size} unique contacts`
    );

    if (allActivities.length === 0) {
      logger.info("No activities with contacts found, done.");
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

    // Build workspace→contact lookup for quick filtering
    let contactsWithWorkspaces = 0;
    for (const [, wsIds] of contactWorkspaces) {
      if (wsIds.length > 0) contactsWithWorkspaces++;
    }

    logger.info(
      `  ${contactsWithWorkspaces}/${externalContacts.size} contacts have workspaces`
    );

    // ====== PHASE 5: Build association pairs ======
    logger.info("Phase 5: Building association pairs...");

    // Group by (typeId, workspaceId) → activityIds
    const groups = new Map<string, Set<string>>();

    for (const activity of allActivities) {
      // Find workspaces via the activity's contacts
      for (const contactId of activity.contactIds) {
        if (!externalContacts.has(contactId)) continue;

        const wsIds = contactWorkspaces.get(contactId) ?? [];
        for (const wsId of wsIds) {
          const key = `${activity.typeId}::${wsId}`;
          if (!groups.has(key)) groups.set(key, new Set());
          groups.get(key)!.add(activity.id);
        }
      }
    }

    // ====== PHASE 6: Check existing + create missing associations ======
    logger.info("Phase 6: Creating associations...");

    let totalCreated = 0;
    let totalAlready = 0;
    let totalTried = 0;

    for (const [key, activityIdSet] of groups) {
      const [typeId, workspaceId] = key.split("::");
      const activityIds = [...activityIdSet];
      totalTried += activityIds.length;

      try {
        // Check which are already linked
        const already = await batchCheckExistingAssociations(
          typeId,
          activityIds,
          workspaceId
        );
        totalAlready += already.size;

        // Create missing
        const toCreate: AssociationPair[] = activityIds
          .filter((id) => !already.has(id))
          .map((id) => ({ fromId: id, toId: workspaceId }));

        if (toCreate.length > 0) {
          const created = await batchCreateAssociations(typeId, toCreate);
          totalCreated += created;
          logger.info(
            `  ${typeId}→ws ${workspaceId}: ${created} created, ${already.size} already`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Association group ${key} failed: ${msg}`);
        errors.push({
          type: `Assoc ${typeId}→ws`,
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
      activitiesWithContacts: allActivities.length,
      uniqueContacts: allContactIds.size,
      externalContacts: externalContacts.size,
      errors: errors.length,
    });

    // Slack notification (success recap)
    const now = new Date();
    const dateFr = `${now.getDate()} ${["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"][now.getMonth()]} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const slackMsg = [
      `[Sync Workspace Activities — Trigger.dev] ${errors.length > 0 ? "⚠️ Erreurs" : "✅ OK"} — ${dateFr} — Période: ${LOOKBACK_HOURS} dernières heures`,
      "",
      "📊 Résultats",
      `- Associations: ${totalCreated} créées | ${totalAlready} déjà liées | ${totalTried} total`,
      `- Contacts: ${internalCount} internes exclus sur ${allContactIds.size} vérifiés`,
      errors.length > 0 ? `\n❌ Erreurs (${errors.length})\n${errors.map((e) => `- ${e.type} (${e.code}) — "${e.message.substring(0, 40)}"`).join("\n")}` : "",
    ].join("\n");

    await sendWorkspaceSlackNotification(slackMsg);

    // Error reporting to script_logs
    await sendErrorToScriptLogs("Sync Workspace Activities", [
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
