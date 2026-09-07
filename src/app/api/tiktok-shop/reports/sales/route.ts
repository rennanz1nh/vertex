import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Sales report computed from our own synced `orders` table (canal = 'TikTok Shop')
 * rather than TikTok's Finance/Statements API — that endpoint needs a separate
 * partner approval tier, while this works the moment orders start syncing/webhooking
 * in, and stays consistent with how the eBay/Amazon sales reports are read elsewhere.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = getSupabase();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("orders")
    .select("data_pedido, total, comissao_tiktok, status")
    .eq("canal", "TikTok Shop")
    .gte("data_pedido", since.toISOString().split("T")[0])
    .order("data_pedido", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byDay = new Map<string, { revenue: number; orders: number; fees: number }>();
  for (const row of data ?? []) {
    const day = row.data_pedido;
    const entry = byDay.get(day) ?? { revenue: 0, orders: 0, fees: 0 };
    entry.revenue += parseFloat(row.total ?? "0");
    entry.fees += parseFloat(row.comissao_tiktok ?? "0");
    entry.orders += 1;
    byDay.set(day, entry);
  }

  const series = [...byDay.entries()].map(([date, v]) => ({ date, ...v }));
  const totals = series.reduce(
    (acc, d) => ({ revenue: acc.revenue + d.revenue, orders: acc.orders + d.orders, fees: acc.fees + d.fees }),
    { revenue: 0, orders: 0, fees: 0 }
  );

  return NextResponse.json({ series, totals });
}
