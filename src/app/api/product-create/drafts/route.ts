import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  const supabase = getSupabase();

  let query = supabase.from("product_drafts").select("*").order("updated_at", { ascending: false });
  if (q) {
    const term = `%${q}%`;
    query = query.or(`name.ilike.${term},brand.ilike.${term},category.ilike.${term},notes.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("product_drafts")
    .insert({
      name: body.name ?? null,
      brand: body.brand ?? null,
      category: body.category ?? null,
      notes: body.notes ?? null,
      price: body.price ?? null,
      images: body.images ?? [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}
