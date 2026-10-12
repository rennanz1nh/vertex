import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();
  const { data } = await supabase.from("turo_tokens").select("id, host_id, host_name, last_synced_at, updated_at").limit(1).maybeSingle();

  return NextResponse.json({ connected: !!data, config: data ?? null });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { bearer_token } = body as { bearer_token: string };
  if (!bearer_token?.trim()) return NextResponse.json({ error: "Token é obrigatório" }, { status: 400 });

  // Test the token by calling Turo's API
  let host_id: string | null = null;
  let host_name: string | null = null;
  try {
    const res = await fetch("https://turo.com/api/v2/hosts/me", {
      headers: {
        Authorization: `Bearer ${bearer_token.trim()}`,
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible)",
      },
    });
    if (res.ok) {
      const data = await res.json();
      host_id = String(data.id ?? data.userId ?? "");
      host_name = data.name ?? data.displayName ?? null;
    }
  } catch {
    // continue even if host info fails — token might still work for trips
  }

  const supabase = adminClient();
  const { data: existing } = await supabase.from("turo_tokens").select("id").limit(1).maybeSingle();

  if (existing) {
    await supabase.from("turo_tokens").update({ bearer_token: bearer_token.trim(), host_id, host_name, updated_at: new Date().toISOString() }).eq("id", existing.id);
  } else {
    await supabase.from("turo_tokens").insert({ bearer_token: bearer_token.trim(), host_id, host_name });
  }

  return NextResponse.json({ ok: true, host_id, host_name });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();
  await supabase.from("turo_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  return NextResponse.json({ ok: true });
}
