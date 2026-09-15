import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

// Searches our own real catalog by any term — name, brand, or the free-text
// description/ingredients field — so "Ácido Glicólico" finds every product that
// mentions it anywhere, not just an exact name match.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ products: [] });

  const supabase = getSupabase();
  const term = `%${q}%`;
  const { data, error } = await supabase
    .from("products")
    .select("id, name, make, image_url, description, daily_rate")
    .or(`name.ilike.${term},make.ilike.${term},description.ilike.${term}`)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    brand: p.make,
    imageUrl: p.image_url,
    description: p.description,
    price: p.daily_rate,
  }));

  return NextResponse.json({ products });
}
