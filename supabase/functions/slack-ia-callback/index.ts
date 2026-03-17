// Supabase Edge Function: slack-ia-callback
// Handles Slack interactive button clicks for Agent IA activation
// Deploy: supabase functions deploy slack-ia-callback --project-ref rcpcdpxqjxeikbssprdz

import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

// Lazy Supabase client
function getSupabase() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key);
}

// Verify Slack request signature
function verifySlackSignature(
  body: string,
  timestamp: string,
  signature: string,
  signingSecret: string
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    console.warn("[signature] Request too old", { timestamp });
    return false;
  }

  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature =
    "v0=" +
    createHmac("sha256", signingSecret).update(sigBasestring).digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(mySignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    console.error("[signature] timingSafeEqual failed");
    return false;
  }
}

// PATCH HubSpot contact property
async function patchHubspotContact(
  contactId: string,
  properties: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const token = Deno.env.get("HUBSPOT_ACCESS_TOKEN") ?? "";
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`;

  console.log("[hubspot] PATCH", { contactId, properties });

  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties }),
    });

    if (res.ok) {
      console.log("[hubspot] PATCH OK", { contactId });
      return { success: true };
    } else {
      const text = await res.text();
      console.error("[hubspot] PATCH failed", { contactId, status: res.status, body: text });
      return { success: false, error: `${res.status}: ${text}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[hubspot] PATCH exception", { contactId, error: msg });
    return { success: false, error: msg };
  }
}

// Update Slack message — on success: replace buttons with status; on failure: keep buttons + show error
async function updateSlackMessage(params: {
  channel: string;
  ts: string;
  originalBlocks: unknown[];
  actionLabel: string;
  statusEmoji: string;
  userName: string;
  keepButtons: boolean;
}): Promise<void> {
  const token = Deno.env.get("slack_agent_ae_sdr_token") ?? "";

  const infoBlock = params.originalBlocks[0];
  const resultBlock = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `${params.statusEmoji} *${params.actionLabel}* par ${params.userName}`,
    },
  };

  // If keepButtons (HubSpot failed), keep the actions block so user can retry
  const blocks = params.keepButtons
    ? [infoBlock, resultBlock, params.originalBlocks[1]]
    : [infoBlock, resultBlock];

  console.log("[slack] chat.update", { channel: params.channel, keepButtons: params.keepButtons });

  try {
    const res = await fetch("https://slack.com/api/chat.update", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: params.channel,
        ts: params.ts,
        blocks,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("[slack] chat.update failed", { error: data.error });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[slack] chat.update exception", { error: msg });
  }
}

// Log action to Supabase slack_ia_action_log
async function logAction(params: {
  hubspot_contact_id: string;
  contact_name: string;
  action: string;
  slack_user_id: string;
  slack_user_name: string;
  slack_channel: string;
  hubspot_success: boolean | null;
  hubspot_error: string | null;
  is_retry: boolean;
}): Promise<void> {
  try {
    const sb = getSupabase();
    const { error } = await sb.from("slack_ia_action_log").insert(params);
    if (error) {
      console.error("[log] Supabase insert failed", { error: error.message });
    } else {
      console.log("[log] Action logged", { action: params.action, contact: params.hubspot_contact_id });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[log] Supabase insert exception", { error: msg });
  }
}

// Send alert to script_logs Slack webhook on HubSpot failure
async function sendErrorAlert(params: {
  contactName: string;
  hubspotContactId: string;
  action: string;
  error: string;
  slackUserName: string;
}): Promise<void> {
  const webhookUrl = Deno.env.get("script_logs") ?? "";
  if (!webhookUrl) {
    console.warn("[alert] script_logs webhook not configured");
    return;
  }

  const text = [
    `[slack-ia-callback] HubSpot PATCH failed`,
    `Contact: ${params.contactName} (${params.hubspotContactId})`,
    `Action: ${params.action}`,
    `User: ${params.slackUserName}`,
    `Error: ${params.error}`,
  ].join("\n");

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    console.log("[alert] Error alert sent to script_logs");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alert] Failed to send error alert", { error: msg });
  }
}

// Detect if this is a retry (message already has a result block = 3+ blocks)
function isRetryClick(originalBlocks: unknown[]): boolean {
  return Array.isArray(originalBlocks) && originalBlocks.length > 2;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signingSecret = Deno.env.get("slack_agent_ae_sdr_signin_secret") ?? "";

  // Read raw body for signature verification
  const rawBody = await req.text();
  const timestamp = req.headers.get("X-Slack-Request-Timestamp") ?? "";
  const signature = req.headers.get("X-Slack-Signature") ?? "";

  if (!verifySlackSignature(rawBody, timestamp, signature, signingSecret)) {
    console.warn("[auth] Invalid signature rejected");
    return new Response("Invalid signature", { status: 401 });
  }

  // Parse Slack interactive payload (URL-encoded with a "payload" field)
  const params = new URLSearchParams(rawBody);
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    console.warn("[parse] Missing payload field");
    return new Response("Missing payload", { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    console.error("[parse] Invalid JSON payload");
    return new Response("Invalid payload", { status: 400 });
  }

  const actions = (payload.actions as Array<Record<string, unknown>>) ?? [];
  const action = actions[0];
  if (!action) {
    console.warn("[parse] No action in payload");
    return new Response("No action", { status: 400 });
  }

  const actionId = String(action.action_id ?? "");
  let valueData: Record<string, string> = {};
  try {
    valueData = JSON.parse(String(action.value ?? "{}"));
  } catch {
    console.error("[parse] Invalid action value JSON");
    return new Response("Invalid action value", { status: 400 });
  }

  const contactHubspotId = valueData.hubspot_contact_id ?? "";
  const contactName = valueData.contact_name ?? "Unknown";
  const channelObj = payload.channel as Record<string, string> | undefined;
  const channel = channelObj?.id ?? "";
  const messageObj = payload.message as Record<string, unknown> | undefined;
  const messageTs = String(messageObj?.ts ?? "");
  const originalBlocks = (messageObj?.blocks as unknown[]) ?? [];
  const userObj = payload.user as Record<string, string> | undefined;
  const slackUserId = userObj?.id ?? "";
  const slackUserName = userObj?.name ?? userObj?.username ?? "Unknown";

  const isRetry = isRetryClick(originalBlocks);

  console.log("[request] Action received", {
    actionId,
    contactHubspotId,
    contactName,
    channel,
    slackUserName,
    isRetry,
  });

  if (!contactHubspotId) {
    console.warn("[request] Missing contact ID in action value");
    return new Response("Missing contact ID", { status: 400 });
  }

  let actionLabel: string;
  let statusEmoji: string;
  let hubspotSuccess: boolean | null = null;
  let hubspotError: string | null = null;
  let keepButtons = false;

  switch (actionId) {
    case "activate_ia": {
      const result = await patchHubspotContact(contactHubspotId, {
        agent_ia_activated: "true",
      });
      hubspotSuccess = result.success;
      hubspotError = result.error ?? null;
      if (result.success) {
        actionLabel = `Agent IA active pour ${contactName}`;
        statusEmoji = "\u2705";
      } else {
        actionLabel = `Erreur activation pour ${contactName}`;
        statusEmoji = "\u274C";
        keepButtons = true;
      }
      break;
    }

    case "never_activate": {
      const result = await patchHubspotContact(contactHubspotId, {
        cancel_agent_ia_activated: "true",
      });
      hubspotSuccess = result.success;
      hubspotError = result.error ?? null;
      if (result.success) {
        actionLabel = `Agent IA bloque definitivement pour ${contactName}`;
        statusEmoji = "\uD83D\uDEAB";
      } else {
        actionLabel = `Erreur blocage pour ${contactName}`;
        statusEmoji = "\u274C";
        keepButtons = true;
      }
      break;
    }

    case "skip_now":
      actionLabel = `Ignore pour ${contactName}`;
      statusEmoji = "\u23ED\uFE0F";
      hubspotSuccess = null; // No HubSpot call
      break;

    default:
      console.warn("[request] Unknown action_id", { actionId });
      return new Response("Unknown action", { status: 400 });
  }

  // Log to Supabase (async, don't block response)
  const logPromise = logAction({
    hubspot_contact_id: contactHubspotId,
    contact_name: contactName,
    action: actionId,
    slack_user_id: slackUserId,
    slack_user_name: slackUserName,
    slack_channel: channel,
    hubspot_success: hubspotSuccess,
    hubspot_error: hubspotError,
    is_retry: isRetry,
  });

  // Alert on HubSpot failure
  const alertPromise = hubspotSuccess === false
    ? sendErrorAlert({
        contactName,
        hubspotContactId: contactHubspotId,
        action: actionId,
        error: hubspotError ?? "unknown",
        slackUserName,
      })
    : Promise.resolve();

  // Update Slack message
  const slackPromise = updateSlackMessage({
    channel,
    ts: messageTs,
    originalBlocks,
    actionLabel,
    statusEmoji,
    userName: slackUserName,
    keepButtons,
  });

  // Run all side effects in parallel
  await Promise.all([logPromise, alertPromise, slackPromise]);

  console.log("[request] Done", { actionId, contactHubspotId, hubspotSuccess });

  return new Response("", { status: 200 });
});
