import { logger, task } from "@trigger.dev/sdk/v3";
import { getAiAeSdrSupabase } from "./lib/ai-ae-sdr-supabase.js";
import { sendErrorToScriptLogs } from "./lib/utils.js";
import {
  type PrcActivity,
  getContactOwner,
  hasActiveDeal,
  buildContactPayload,
  sendToLangGraph,
  logSend,
} from "./send-contacts-to-langgraph.js";

// ============================================
// MANUAL TASK: Send a single contact to LangGraph
// ============================================
export const sendSingleContactToLanggraphTask = task({
  id: "send-single-contact-to-langgraph",
  run: async (payload: { contactHubspotId?: string }) => {
    logger.info("=== START send-single-contact-to-langgraph ===", payload);

    const sb = getAiAeSdrSupabase();
    const batchId = `single-${new Date().toISOString().substring(0, 19)}`;

    // 1. Resolve which contact to send
    let contactId: string;

    if (payload?.contactHubspotId) {
      contactId = payload.contactHubspotId;
      logger.info(`Using provided contact: ${contactId}`);
    } else {
      // Pick a random activated contact with a valid owner
      logger.info("No contactHubspotId provided — picking random activated contact");
      contactId = await pickRandomContact(sb);
      logger.info(`Randomly selected contact: ${contactId}`);
    }

    // 2. Fetch activities for this contact
    const { data: activities, error: fetchError } = await sb
      .from("PRC_CONTACT_ACTIVITIES")
      .select("*")
      .eq("CONTACT_HUBSPOT_ID", contactId);

    if (fetchError) {
      throw new Error(`Failed to fetch activities for ${contactId}: ${fetchError.message}`);
    }

    const typedActivities = (activities ?? []) as PrcActivity[];

    if (typedActivities.length === 0) {
      throw new Error(`No activities found for contact ${contactId} in PRC_CONTACT_ACTIVITIES`);
    }

    // 3. Check activation
    const activated = typedActivities.some((a) => a.IS_CONTACT_IA_AGENT_ACTIVATED === true);
    if (!activated) {
      throw new Error(`Contact ${contactId} has IS_CONTACT_IA_AGENT_ACTIVATED = false`);
    }

    // 4. Resolve owner
    const owner = getContactOwner(typedActivities);
    if (!owner) {
      throw new Error(`Contact ${contactId} has no owner (OWNER_CONTACT_INTENT_HUBSPOT is empty)`);
    }

    // 5. Determine tier
    const tier: 1 | 2 = hasActiveDeal(typedActivities) ? 1 : 2;

    // 6. Build payload
    const contactPayload = buildContactPayload(contactId, typedActivities);
    logger.info(`Payload built — ${contactPayload.stats.total_activities} activities, Tier ${tier}, Owner: ${owner.name}`);

    // 7. Send to LangGraph (no cooldown check)
    const result = await sendToLangGraph(contactPayload);

    // 8. Log to langgraph_send_log
    await logSend(sb, {
      runId: batchId,
      contactId,
      payload: contactPayload,
      tier,
      ownerHubspotId: owner.id,
      ownerName: owner.name,
      status: result.success ? "success" : "error",
      langgraphRunId: result.runId ?? null,
      errorMessage: result.error ?? null,
    });

    // 9. Slack recap
    const webhookUrl = process.env.script_logs ?? "";
    if (webhookUrl) {
      const status = result.success ? "✅" : "❌";
      const message = [
        `[Send Single Contact to LangGraph] ${status} — ${batchId}`,
        "",
        `👤 *${contactPayload.contact_info.full_name}* (${contactId})`,
        `• Owner: ${owner.name}`,
        `• Tier: ${tier}`,
        `• Activities: ${contactPayload.stats.total_activities}`,
        `• Company: ${contactPayload.contact_info.company ?? "N/A"}`,
        `• Job: ${contactPayload.contact_info.job ?? "N/A"}`,
        result.success
          ? `• LangGraph run: ${result.runId}`
          : `• Error: ${result.error}`,
      ].join("\n");

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      }).catch((err) => logger.error("Slack recap failed", { error: String(err) }));
    }

    if (!result.success) {
      await sendErrorToScriptLogs("Send Single Contact to LangGraph", [
        {
          label: contactId,
          inserted: 0,
          skipped: 0,
          errors: [{ type: "LangGraph Send", code: result.statusCode ?? "unknown", message: result.error ?? "unknown", profile: contactId }],
        },
      ]);
      throw new Error(`LangGraph send failed: ${result.error}`);
    }

    const summary = {
      success: true,
      contactId,
      contactName: contactPayload.contact_info.full_name,
      owner: owner.name,
      tier,
      totalActivities: contactPayload.stats.total_activities,
      langgraphRunId: result.runId,
    };

    logger.info("=== DONE ===", summary);
    return summary;
  },
});

// ============================================
// RANDOM CONTACT PICKER
// ============================================
async function pickRandomContact(
  sb: ReturnType<typeof getAiAeSdrSupabase>
): Promise<string> {
  // Fetch activated contacts (limited sample for performance)
  const { data, error } = await sb
    .from("PRC_CONTACT_ACTIVITIES")
    .select("CONTACT_HUBSPOT_ID, OWNER_CONTACT_INTENT_HUBSPOT")
    .eq("IS_CONTACT_IA_AGENT_ACTIVATED", true)
    .neq("IS_CANCEL_AGENT_IA_ACTIVATED", true)
    .limit(500);

  if (error) {
    throw new Error(`Failed to fetch activated contacts: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("No activated contacts found in PRC_CONTACT_ACTIVITIES");
  }

  // Deduplicate by contact ID and filter those with an owner
  const contactsWithOwner = new Map<string, boolean>();
  for (const row of data) {
    const cid = (row as Record<string, unknown>).CONTACT_HUBSPOT_ID as string | undefined;
    if (!cid || contactsWithOwner.has(cid)) continue;

    const ownerRaw = (row as Record<string, unknown>).OWNER_CONTACT_INTENT_HUBSPOT;
    let hasOwner = false;
    if (ownerRaw) {
      try {
        const parsed = typeof ownerRaw === "string" ? JSON.parse(ownerRaw) : ownerRaw;
        hasOwner = !!(parsed as Record<string, unknown>)?.owner_hubspot_id;
      } catch { /* ignore */ }
    }

    if (hasOwner) {
      contactsWithOwner.set(cid, true);
    }
  }

  const eligibleIds = [...contactsWithOwner.keys()];
  if (eligibleIds.length === 0) {
    throw new Error("No activated contacts with a valid owner found");
  }

  const randomIndex = Math.floor(Math.random() * eligibleIds.length);
  return eligibleIds[randomIndex];
}
