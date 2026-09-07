import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
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
    .select(`id, "Produto Nome", "Marca", image_url, "Informacoes dos produtos / descricao", "Valor de venda (Online)"`)
    .or(
      `"Produto Nome".ilike.${term},"Marca".ilike.${term},"Informacoes dos produtos / descricao".ilike.${term}`
    )
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p["Produto Nome"],
    brand: p["Marca"],
    imageUrl: p.image_url,
    description: p["Informacoes dos produtos / descricao"],
    price: p["Valor de venda (Online)"],
  }));

  return NextResponse.json({ products });
}
