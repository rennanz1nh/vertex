import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMasterAdmin, requireStaff } from "@/lib/admin-auth";
import { activeTuroTokenRow } from "@/lib/turo-token-row";

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
  const auth = await requireStaff(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();
  const { data, error } = await activeTuroTokenRow(
    supabase,
    "id, host_id, host_name, last_synced_at, updated_at, sync_key, host_data_synced_at, auto_sync_at, auto_sync_ok, auto_sync_message, extension_seen_at, extension_ok, extension_message",
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connected: !!data, config: data ?? null });
}

export async function POST(request: NextRequest) {
  const auth = await requireStaff(request);
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
  const { data: existingRow, error: selectErr } = await activeTuroTokenRow<{ id: string; host_name: string | null }>(supabase, "id, host_name");
  const existing = existingRow;

  if (selectErr) return NextResponse.json({ error: selectErr.message }, { status: 500 });

  if (existing) {
    // Keep host_name (filled by the browser sync) and keep a single row: any other row is a
    // stale leftover that would otherwise be picked by mistake.
    const { error: updateErr } = await supabase
      .from("turo_tokens")
      .update({ bearer_token: raw, host_id, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    await supabase.from("turo_tokens").delete().neq("id", existing.id);
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
