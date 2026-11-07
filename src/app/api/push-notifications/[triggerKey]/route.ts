import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PUSH_CATALOG_BY_KEY } from "@/lib/push-catalog";
import type { PushTriggerKey } from "@/lib/notify";

const EDITABLE_FIELDS = ["enabled", "title", "message", "tags"] as const;

// Toggle or edit one notification. The first change creates its row from the catalog
// defaults; later changes update it.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ triggerKey: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { triggerKey } = await params;
  const entry = PUSH_CATALOG_BY_KEY.get(triggerKey as PushTriggerKey);
  if (!entry) return NextResponse.json({ error: "Tipo de notificação desconhecido" }, { status: 400 });

  const body = await request.json();
  const patch: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) patch[field] = body[field];
  }
  if (typeof patch.title === "string" && !patch.title.trim()) delete patch.title;
  if (typeof patch.message === "string" && !patch.message.trim()) delete patch.message;

  const { data: existing } = await supabaseAdmin.from("push_preferences").select("trigger_key").eq("trigger_key", entry.key).maybeSingle();
  const row = { ...patch, updated_at: new Date().toISOString() };
  const { data, error } = existing
    ? await supabaseAdmin.from("push_preferences").update(row).eq("trigger_key", entry.key).select().single()
    : await supabaseAdmin
        .from("push_preferences")
        .insert({ trigger_key: entry.key, enabled: entry.defaultEnabled, title: entry.title, message: entry.message, tags: entry.tags.join(","), ...row })
        .select()
        .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notification: { ...data, customized: true } });
}
