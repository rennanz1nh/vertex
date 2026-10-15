import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMasterAdmin } from "@/lib/admin-auth";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

// bearer_token column stores either:
// - a bare JWT (starts with "eyJ")
// - the full cookie header string (contains "access_token=eyJ")
export function extractAccessToken(stored: string): string {
  if (stored.includes("access_token=")) {
    const match = stored.match(/access_token=([^;]+)/);
    return match ? match[1].trim() : stored.trim();
  }
  return stored.trim();
}

export async function GET(request: NextRequest) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();
  const { data, error } = await supabase
    .from("turo_tokens")
    .select("id, host_id, host_name, last_synced_at, updated_at, sync_key, host_data_synced_at, auto_sync_at, auto_sync_ok, auto_sync_message")
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connected: !!data, config: data ?? null });
}

export async function POST(request: NextRequest) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  // Accept either full cookie string or bare bearer token
  const raw = ((body as Record<string, string>).bearer_token ?? (body as Record<string, string>).cookie_string ?? "").trim();
  if (!raw) return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 });

  // Try to identify host from JWT (skip Cloudflare-gated API call)
  const accessToken = extractAccessToken(raw);
  let host_id: string | null = null;
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    host_id = String(payload.driver_id ?? payload.sub ?? "");
  } catch { /* ignore */ }

  const supabase = adminClient();
  const { data: existing, error: selectErr } = await supabase
    .from("turo_tokens")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (selectErr) return NextResponse.json({ error: selectErr.message }, { status: 500 });

  if (existing) {
    const { error: updateErr } = await supabase
      .from("turo_tokens")
      .update({ bearer_token: raw, host_id, host_name: null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  } else {
    const { error: insertErr } = await supabase
      .from("turo_tokens")
      .insert({ bearer_token: raw, host_id, host_name: null });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, host_id });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();
  await supabase.from("turo_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  return NextResponse.json({ ok: true });
}
