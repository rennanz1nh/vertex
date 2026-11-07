import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PUSH_CATALOG } from "@/lib/push-catalog";

// Every Vertex notification from the catalog, with the saved row (if any) applied on top.
// Rows for triggers outside the catalog (old shop alerts) are left out.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { data, error } = await supabaseAdmin.from("push_preferences").select("trigger_key, enabled, title, message, tags");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const saved = new Map((data ?? []).map((r) => [r.trigger_key as string, r]));

  const notifications = PUSH_CATALOG.map((e) => {
    const row = saved.get(e.key);
    return {
      trigger_key: e.key,
      enabled: row ? !!row.enabled : e.defaultEnabled,
      title: row?.title ?? e.title,
      message: row?.message ?? e.message,
      tags: row?.tags ?? e.tags.join(","),
      customized: !!row,
    };
  });
  return NextResponse.json({ notifications });
}
