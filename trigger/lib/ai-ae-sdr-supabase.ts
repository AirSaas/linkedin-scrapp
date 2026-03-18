/**
 * Client Supabase pour le projet ai_ae_sdr_agent (rcpcdpxqjxeikbssprdz)
 * Source de PRC_CONTACT_ACTIVITIES pour send-contacts-to-langgraph
 *
 * Env vars dédiées :
 * - AI_AE_SDR_SUPABASE_URL
 * - AI_AE_SDR_SUPABASE_KEY
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getAiAeSdrSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.AI_AE_SDR_SUPABASE_URL!,
      process.env.AI_AE_SDR_SUPABASE_KEY!
    );
  }
  return _client;
}
