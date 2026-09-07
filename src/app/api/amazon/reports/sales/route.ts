import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getReportDateRange, isReportPeriod } from "@/lib/report-periods";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

type OrderRow = {
  id: string;
  total: number | null;
  data_pedido: string;
  status: string;
  order_items: { quantidade: number | null }[] | null;
};

// Mirrors /api/ebay/reports/sales almost 1:1 — the entire report is just orders filtered
// by channel, and 'Amazon' is already a valid value of the sales_channel enum.
async function fetchSalesWindow(start: string, end: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("id, total, data_pedido, status, order_items(quantidade)")
    .eq("canal", "Amazon")
    .gte("data_pedido", start)
    .lte("data_pedido", end);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as OrderRow[];
  const revenue = rows.reduce((sum, r) => sum + (r.total ?? 0), 0);
  const orderCount = rows.length;
  const unitsSold = rows.reduce(
    (sum, r) => sum + (r.order_items ?? []).reduce((s, i) => s + (i.quantidade ?? 0), 0),
    0
  );

  const byDay = new Map<string, number>();
  for (const r of rows) {
    byDay.set(r.data_pedido, (byDay.get(r.data_pedido) ?? 0) + (r.total ?? 0));
  }
  const daily = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));

  return { revenue, orderCount, unitsSold, daily };
}

function previousWindow(start: string, end: string) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startDate = new Date(Date.UTC(sy, sm - 1, sd));
  const endDate = new Date(Date.UTC(ey, em - 1, ed));
  const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  const prevEnd = new Date(startDate);
  prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setUTCDate(prevStart.getUTCDate() - (spanDays - 1));

  return { start: prevStart.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10) };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const periodParam = request.nextUrl.searchParams.get("period");
  if (!isReportPeriod(periodParam)) {
    return NextResponse.json({ error: "period inválido (use today, yesterday, 7d ou 30d)" }, { status: 400 });
  }
  if (periodParam === "90d" || periodParam === "all") {
    return NextResponse.json({ error: "Período não suportado no relatório de vendas da Amazon" }, { status: 400 });
  }

  try {
    const { start, end } = getReportDateRange(periodParam);
    const prev = previousWindow(start, end);

    const [current, previous] = await Promise.all([fetchSalesWindow(start, end), fetchSalesWindow(prev.start, prev.end)]);

    return NextResponse.json({
      period: periodParam,
      range: { start, end },
      revenue: current.revenue,
      orderCount: current.orderCount,
      unitsSold: current.unitsSold,
      avgOrderValue: current.orderCount > 0 ? current.revenue / current.orderCount : 0,
      daily: current.daily,
      changeVsPrevious: {
        revenue: pctChange(current.revenue, previous.revenue),
        orderCount: pctChange(current.orderCount, previous.orderCount),
        unitsSold: pctChange(current.unitsSold, previous.unitsSold),
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
