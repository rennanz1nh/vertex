import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Only the topic name goes in the DB (sendNtfy builds the full https://ntfy.sh/<topic>
// URL itself) — strips a pasted-in protocol/domain/slashes so saving the full ntfy.sh
// link someone copied from the app doesn't silently double it up into a broken URL.
function normalizeNtfyTopic(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^ntfy\.sh\//i, "")
    .replace(/^\/+|\/+$/g, "");
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { enabled, ntfy_topic } = body;

  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("notification_settings")
    .select("id")
    .limit(1)
    .maybeSingle();

  const normalizedTopic = typeof ntfy_topic === "string" ? normalizeNtfyTopic(ntfy_topic) : "";
  const update = {
    enabled: !!enabled,
    ntfy_topic: normalizedTopic !== "" ? normalizedTopic : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabase.from("notification_settings").update(update).eq("id", existing.id).select().single()
    : await supabase.from("notification_settings").insert(update).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ settings: data });
}
