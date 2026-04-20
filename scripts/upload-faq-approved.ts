/**
 * One-shot script: upload a FAQ markdown file to Supabase as type=faq_approved.
 *
 * Stores (or updates) the canonical FAQ reference used by:
 *   - trigger/propose-faq-updates.ts
 *   - trigger/audit-circle-vs-faq.ts
 *
 * Usage:
 *   TCHAT_SUPPORT_SYNC_SUPABASE_URL=https://oqiowupiczgrezgyopfm.supabase.co \
 *   TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY=xxx \
 *   npx tsx scripts/upload-faq-approved.ts docs/faq-approved-2026-04-20.md
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const SUPABASE_URL = process.env.TCHAT_SUPPORT_SYNC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing TCHAT_SUPPORT_SYNC_SUPABASE_URL or TCHAT_SUPPORT_SYNC_SUPABASE_SERVICE_KEY");
    process.exit(1);
  }

  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npx tsx scripts/upload-faq-approved.ts <path/to/faq.md>");
    process.exit(1);
  }

  const absPath = resolve(filePath);
  const markdown = readFileSync(absPath, "utf-8");
  console.log(`Read ${markdown.length} chars from ${absPath}`);

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { data: existing, error: selectErr } = await sb
    .from("tchat_faq_documents")
    .select("id, version")
    .eq("type", "faq_approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectErr) {
    console.error("SELECT failed:", selectErr.message);
    process.exit(1);
  }

  const nowIso = new Date().toISOString();

  if (existing) {
    const { error } = await sb
      .from("tchat_faq_documents")
      .update({ markdown, generated_at: nowIso })
      .eq("id", existing.id);

    if (error) {
      console.error("UPDATE failed:", error.message);
      process.exit(1);
    }
    console.log(`✅ Updated faq_approved v${existing.version} (id=${existing.id})`);
    return;
  }

  const { data: maxRow } = await sb
    .from("tchat_faq_documents")
    .select("version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (maxRow?.version ?? 0) + 1;

  const { data: inserted, error } = await sb
    .from("tchat_faq_documents")
    .insert({
      version: nextVersion,
      generated_at: nowIso,
      model_used: "manual",
      markdown,
      stats: {},
      metadata: { source_file: filePath },
      type: "faq_approved",
    })
    .select("id, version")
    .single();

  if (error) {
    console.error("INSERT failed:", error.message);
    process.exit(1);
  }
  console.log(`✅ Inserted faq_approved v${inserted.version} (id=${inserted.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
