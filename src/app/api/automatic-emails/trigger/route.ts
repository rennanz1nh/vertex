import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAutomaticEmail, type EmailTriggerKey } from "@/lib/automatic-emails";
import { getTrackingUrl } from "@/lib/carrier-utils";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

const ORDER_TRIGGERS: EmailTriggerKey[] = ["order_shipped", "order_delivered", "order_cancelled"];

/**
 * Order-status-change triggers (shipped/delivered/cancelled) called from client code
 * (Orders.tsx's auto Shippo-sync, OrderForm's "Marcar como Enviado" button) — those run
 * in the browser and can't hold the Brevo API key, so they just tell us which order
 * changed and this route looks up everything needed and sends through sendAutomaticEmail.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { triggerKey, orderId } = await request.json();
  if (!ORDER_TRIGGERS.includes(triggerKey)) {
    return NextResponse.json({ error: "triggerKey inválido" }, { status: 400 });
  }
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ error: "orderId é obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: order, error } = await supabase
    .from("orders")
    .select("numero_pedido_canal, shipping_tracking, carrier, clients(email, nome_razao)")
    .eq("id", orderId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  const client = (order as unknown as { clients: { email: string | null; nome_razao: string | null } | null }).clients;
  if (!client?.email) {
    // Nothing to send to (no client on file, or client has no email) — not an error,
    // just nothing to do.
    return NextResponse.json({ ok: true, skipped: "no_email" });
  }

  await sendAutomaticEmail(
    triggerKey,
    { email: client.email, name: client.nome_razao ?? undefined },
    {
      customer_name: client.nome_razao ?? "there",
      order_number: order.numero_pedido_canal ?? orderId,
      carrier: order.carrier ?? "",
      tracking_number: order.shipping_tracking ?? "",
      tracking_url: order.shipping_tracking ? getTrackingUrl(order.shipping_tracking, order.carrier) : "",
    }
  );

  return NextResponse.json({ ok: true });
}
