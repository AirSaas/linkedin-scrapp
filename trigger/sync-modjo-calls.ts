import { logger, schedules } from "@trigger.dev/sdk/v3";
import { getSupabase } from "./lib/supabase.js";
import { sendErrorToScriptLogs, type TaskError } from "./lib/utils.js";

// ============================================
// CONFIGURATION
// ============================================
const MODJO_API_BASE = "https://api.modjo.ai/v1";
const LOOKBACK_DAYS = 90;
const PER_PAGE = 50;
const MAX_PAGES = 4;
const BATCH_SIZE = 50;

// ============================================
// TYPES
// ============================================
interface ModjoSpeaker {
  speakerId: number;
  name?: string;
  email?: string;
  type?: string;
  contactCrmId?: string;
  userCrmId?: string;
}

interface ModjoTranscriptSegment {
  speakerId: number;
  startTime: number;
  content: string;
}

interface ModjoRelations {
  speakers?: ModjoSpeaker[];
  transcript?: ModjoTranscriptSegment[];
  aiSummary?: { content?: string };
  deal?: { dealCrmId?: string; name?: string };
  account?: { accountCrmId?: string; name?: string };
  contacts?: { contactCrmId?: string; name?: string; email?: string }[];
  topics?: { name: string }[];
  tags?: { name: string }[];
}

interface ModjoCall {
  callId: number;
  title: string;
  startDate: string;
  duration: number;
  relations: ModjoRelations;
}

interface SpeakerInfo {
  name: string;
  email: string;
  type: string;
  hubspotId: string | null;
  contactCrmId: string | null;
}

interface SupabaseRow {
  call_id: number;
  hubspot_deal_id: string | null;
  hubspot_account_id: string | null;
  hubspot_contact_ids: string[];
  title: string;
  call_date: string;
  duration_seconds: number;
  participants: { name: string; email: string; type: string; hubspot_id: string | null }[];
  ai_summary: string | null;
  transcript_clean: string;
  topics: string[];
  tags: string[];
  raw_data: ModjoCall;
  synced_at: string;
}

// ============================================
// HELPERS
// ============================================
function formatTime(seconds: number): string {
  if (!seconds && seconds !== 0) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function buildSpeakerMapping(relations: ModjoRelations): Record<number, SpeakerInfo> {
  const mapping: Record<number, SpeakerInfo> = {};

  if (relations.speakers && Array.isArray(relations.speakers)) {
    for (const speaker of relations.speakers) {
      mapping[speaker.speakerId] = {
        name: speaker.name || speaker.email || `Speaker ${speaker.speakerId}`,
        email: speaker.email || "",
        type: speaker.type || "unknown",
        hubspotId: speaker.type === "contact" ? (speaker.contactCrmId ?? null) : (speaker.userCrmId ?? null),
        contactCrmId: speaker.contactCrmId ?? null,
      };
    }
  }

  return mapping;
}

function cleanTranscript(call: ModjoCall): string {
  const speakerMapping = buildSpeakerMapping(call.relations);
  const transcript = call.relations?.transcript || [];

  return transcript
    .map((seg) => {
      const info = speakerMapping[seg.speakerId];
      const emoji = info ? (info.type === "user" ? "\u{1F464}" : "\u{1F3AF}") : "\u{2753}";
      const name = info ? info.name : `Speaker ${seg.speakerId}`;
      const time = formatTime(seg.startTime);
      return `[${time}] ${emoji} ${name}: ${seg.content}`;
    })
    .join("\n");
}

function buildParticipantsJson(
  call: ModjoCall
): { name: string; email: string; type: string; hubspot_id: string | null }[] {
  const speakerMapping = buildSpeakerMapping(call.relations);

  return Object.values(speakerMapping).map((info) => ({
    name: info.name,
    email: info.email,
    type: info.type,
    hubspot_id: info.hubspotId,
  }));
}

function extractContactIds(call: ModjoCall): string[] {
  const speakerMapping = buildSpeakerMapping(call.relations);

  return Object.values(speakerMapping)
    .filter((info) => info.type === "contact" && info.contactCrmId)
    .map((info) => info.contactCrmId!);
}

function callToSupabaseRow(call: ModjoCall): SupabaseRow {
  return {
    call_id: call.callId,
    hubspot_deal_id: call.relations?.deal?.dealCrmId || null,
    hubspot_account_id: call.relations?.account?.accountCrmId || null,
    hubspot_contact_ids: extractContactIds(call),
    title: call.title,
    call_date: call.startDate,
    duration_seconds: Math.round(call.duration),
    participants: buildParticipantsJson(call),
    ai_summary: call.relations?.aiSummary?.content || null,
    transcript_clean: cleanTranscript(call),
    topics: (call.relations?.topics || []).map((t) => t.name),
    tags: (call.relations?.tags || []).map((t) => t.name),
    raw_data: call,
    synced_at: new Date().toISOString(),
  };
}

// ============================================
// MODJO API
// ============================================
async function fetchModjoCalls(startDate: string, endDate: string): Promise<ModjoCall[]> {
  const apiKey = process.env.MODJO_API_KEY ?? "";
  if (!apiKey) throw new Error("MODJO_API_KEY env var not set");

  const allCalls: ModjoCall[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    logger.info(`Fetching Modjo page ${page}...`);

    const res = await fetch(`${MODJO_API_BASE}/calls/exports`, {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pagination: { page, perPage: PER_PAGE },
        filters: {
          callStartDateRange: { start: startDate, end: endDate },
        },
        relations: {
          recording: true,
          aiSummary: true,
          transcript: true,
          speakers: true,
          contacts: true,
          account: true,
          deal: true,
          users: true,
          tags: true,
          topics: true,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Modjo API HTTP ${res.status}: ${text.substring(0, 300)}`);
    }

    const data = (await res.json()) as { values?: ModjoCall[]; pagination?: { totalValues?: number } };
    const calls = data.values || [];
    allCalls.push(...calls);

    logger.info(`Page ${page}: ${calls.length} calls (total so far: ${allCalls.length})`);

    if (calls.length < PER_PAGE) break;
  }

  return allCalls;
}

// ============================================
// SCHEDULED TASK
// ============================================
export const syncModjoCallsTask = schedules.task({
  id: "sync-modjo-calls",
  maxDuration: 300,
  run: async () => {
    logger.info("=== START sync-modjo-calls ===");

    const errors: TaskError[] = [];
    const now = new Date();
    const startDate = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const endDate = now.toISOString();

    // 1. Fetch calls from Modjo
    let calls: ModjoCall[];
    try {
      calls = await fetchModjoCalls(startDate, endDate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to fetch Modjo calls: ${msg}`);
      await sendErrorToScriptLogs("Sync Modjo Calls", [{
        label: "Modjo API",
        inserted: 0,
        skipped: 0,
        errors: [{ type: "Modjo Fetch", code: "exception", message: msg }],
      }]);
      throw err;
    }

    logger.info(`Fetched ${calls.length} calls from Modjo`);

    if (calls.length === 0) {
      logger.info("No calls to sync");
      return { success: true, totalFetched: 0, totalSynced: 0 };
    }

    // 2. Transform to Supabase rows
    const rows: SupabaseRow[] = [];
    for (const call of calls) {
      try {
        rows.push(callToSupabaseRow(call));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Transform error for call ${call.callId}: ${msg}`);
        errors.push({
          type: "Transform",
          code: "exception",
          message: `call ${call.callId}: ${msg}`,
        });
      }
    }

    // 3. Upsert by batch
    let totalSynced = 0;
    const supabase = getSupabase();

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      try {
        const { error } = await supabase
          .from("modjo_calls")
          .upsert(batch, { onConflict: "call_id" });

        if (error) {
          throw new Error(error.message);
        }

        totalSynced += batch.length;
        logger.info(`Batch ${batchNum}: ${batch.length} calls upserted`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Upsert batch ${batchNum} failed: ${msg}`);
        errors.push({
          type: "Supabase Upsert",
          code: "exception",
          message: `batch ${batchNum}: ${msg}`,
        });
      }
    }

    // 4. Error reporting
    await sendErrorToScriptLogs("Sync Modjo Calls", [{
      label: "Calls",
      inserted: totalSynced,
      skipped: calls.length - rows.length,
      errors,
    }]);

    const summary = {
      success: errors.length === 0,
      totalFetched: calls.length,
      totalSynced,
      errors: errors.length,
    };

    logger.info("=== SUMMARY ===", summary);
    return summary;
  },
});
