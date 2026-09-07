import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Manually links an already-purchased (orphaned) Shippo transaction to an order — the
 * recovery path for when /api/shippo/label's own order-update silently failed. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { order_id, tracking_number, carrier, amount } = await req.json();

  if (!order_id || !tracking_number) {
    return NextResponse.json({ error: "order_id e tracking_number são obrigatórios" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { error, count } = await supabase
    .from("orders")
    .update(
      {
        shipping_tracking: tracking_number,
        carrier: carrier || null,
        custo_total_shipping: amount != null ? parseFloat(amount) : null,
      },
      { count: "exact" }
    )
    .eq("id", order_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
