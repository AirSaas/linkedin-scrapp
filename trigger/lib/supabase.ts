import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_KEY!
    );
  }
  return _supabase;
}

let _supabaseIaSales: SupabaseClient | null = null;

export function getSupabaseIaSales(): SupabaseClient {
  if (!_supabaseIaSales) {
    _supabaseIaSales = createClient(
      process.env.SUPABASE_IA_SALES_URL!,
      process.env.SUPABASE_IA_SALES_KEY!
    );
  }
  return _supabaseIaSales;
}

/**
 * @deprecated Use getSupabase() instead — kept for backward compatibility.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop];
  },
});
