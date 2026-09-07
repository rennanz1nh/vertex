import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// "Similar products that already sell well" — our own best signal, no external API
// needed: every order_item for a product whose brand/category/name matches the term,
// ranked by how many units it has actually sold.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ products: [] });

  const supabase = getSupabase();
  const term = `%${q}%`;

  const { data, error } = await supabase
    .from("order_items")
    .select(`quantidade, product_id, products!inner("Produto Nome","Marca",image_url,"Valor de venda (Online)")`)
    .or(`"Produto Nome".ilike.${term},"Marca".ilike.${term},"Linha do produto".ilike.${term}`, { foreignTable: "products" })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totals = new Map<string, { name: string; brand: string; imageUrl: string | null; price: string | null; qty: number }>();
  for (const row of data ?? []) {
    if (!row.product_id) continue;
    const p = (row as any).products;
    const existing = totals.get(row.product_id);
    const qty = Number(row.quantidade) || 0;
    if (existing) {
      existing.qty += qty;
    } else {
      totals.set(row.product_id, {
        name: p?.["Produto Nome"] ?? "",
        brand: p?.["Marca"] ?? "",
        imageUrl: p?.image_url ?? null,
        price: p?.["Valor de venda (Online)"] ?? null,
        qty,
      });
    }
  }

  const products = [...totals.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  return NextResponse.json({ products });
}
