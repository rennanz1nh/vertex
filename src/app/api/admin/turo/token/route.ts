// Returns the stored access_token so the browser can call Turo's API directly.
// Admin-only endpoint — the token is the user's own credential.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";
import { extractAccessToken } from "@/app/api/admin/turo/config/route";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );

  const { data, error } = await supabase
    .from("turo_tokens")
    .select("bearer_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Não conectado" }, { status: 404 });

  const accessToken = extractAccessToken(data.bearer_token);
  return NextResponse.json({ access_token: accessToken });
}
