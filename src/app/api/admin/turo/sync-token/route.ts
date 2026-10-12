import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { randomUUID } from "crypto";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = adminClient();
  const { data: tokenRow } = await supabase
    .from("turo_tokens")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!tokenRow) return NextResponse.json({ error: "Não conectado" }, { status: 404 });

  const token = randomUUID();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await supabase
    .from("turo_tokens")
    .update({ sync_token: token, sync_token_expires_at: expires.toISOString() })
    .eq("id", tokenRow.id);

  return NextResponse.json({ token });
}
