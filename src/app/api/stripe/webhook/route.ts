import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { sendAutomaticEmail } from "@/lib/automatic-emails";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await fulfillOrder(session);
    } catch (err) {
      console.error("Failed to fulfill order for session", session.id, err);
      return NextResponse.json({ error: "Order fulfillment failed" }, { status: 500 });
    }
  }

  // Fires once the Checkout Session's own expires_at passes with no completed payment —
  // that expiry is set from the abandoned_cart trigger's own delay_hours (see
  // /api/stripe/checkout), so "expired" here already means "abandoned long enough".
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    await notifyAbandonedCart(session);
  }

  // refund.updated fires on every status transition (pending -> succeeded/failed/canceled).
  // Only "succeeded" means the refund is actually done — for card refunds that's nearly
  // instant, but async methods (bank debits, some wallets) sit in "pending" for days first,
  // so charge.refunded/amount_refunded can't be trusted as the completion signal on its own.
  // Never lets an email/lookup hiccup fail the webhook response — the refund itself already
  // went through on Stripe's side either way.
  if (event.type === "refund.updated") {
    const refund = event.data.object as Stripe.Refund;
    if (refund.status === "succeeded") {
      try {
        await notifyRefund(refund);
      } catch (err) {
        console.error("Failed to process refund notification for refund", refund.id, err);
      }
    }
  }

  return NextResponse.json({ received: true });
}

async function notifyRefund(refund: Stripe.Refund) {
  const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (!paymentIntentId) return; // not a Checkout-originated payment we can trace back to an order

  const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
  const session = sessions.data[0];
  if (!session) return;

  const { data: order } = await supabase
    .from("orders")
    .select("id, numero_pedido_canal, status")
    .eq("numero_pedido_canal", session.id)
    .maybeSingle();
  if (!order) return;

  // Only flip the order to Cancelado once the charge ends up fully refunded — a partial
  // refund still gets the email below, but the order stays as-is since it's still
  // (partially) fulfilled. Re-fetch the charge rather than trusting a stale flag on the
  // refund event, since this refund may be one of several partial ones.
  const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
  if (chargeId && order.status !== "Cancelado") {
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.refunded) {
      await supabase.from("orders").update({ status: "Cancelado" }).eq("id", order.id);
    }
  }

  const email = session.customer_details?.email;
  if (!email) return;
  const name = session.customer_details?.name ?? undefined;

  await sendAutomaticEmail(
    "order_refunded",
    { email, name },
    {
      customer_name: name ?? "there",
      order_number: order.numero_pedido_canal ?? order.id,
      refund_amount: `$${(refund.amount / 100).toFixed(2)}`,
    }
  );
}

async function notifyAbandonedCart(session: Stripe.Checkout.Session) {
  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) return; // never collected an email — nothing to send to

  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { expand: ["data.price.product"] });
    const itemsList = lineItems.data
      .map((item) => {
        const product = item.price?.product as Stripe.Product | undefined;
        return `${item.quantity}x ${product?.name ?? "Item"}`;
      })
      .join(", ");

    await sendAutomaticEmail(
      "abandoned_cart",
      { email, name: session.customer_details?.name ?? undefined },
      {
        customer_name: session.customer_details?.name ?? "there",
        items_list: itemsList,
        store_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://cosmeticmkt.com"}/cart`,
      }
    );
  } catch (err) {
    console.error("Failed to send abandoned cart email for session", session.id, err);
  }
}

async function fulfillOrder(session: Stripe.Checkout.Session) {
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ["data.price.product"],
  });

  const customerDetails = session.customer_details;
  const shipping = session.collected_information?.shipping_details ?? null;
  const address = shipping?.address ?? customerDetails?.address ?? null;

  let clientId: string | null = null;
  if (customerDetails?.email) {
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("email", customerDetails.email)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await supabase
        .from("clients")
        .insert({
          nome_razao: shipping?.name || customerDetails.name || customerDetails.email,
          email: customerDetails.email,
          telefone: customerDetails.phone || null,
          endereco_cidade: address?.city || null,
          tipo: "Cliente Final" as const,
          canal_principal: "Vertex Rental Cars",
        })
        .select()
        .single();

      if (clientError) throw clientError;
      clientId = newClient.id;
    }
  }

  const enderecoCompleto = address
    ? [address.line1, address.line2, address.city, address.state, address.postal_code, address.country]
        .filter(Boolean)
        .join(", ")
    : null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      data_pedido: new Date().toISOString().slice(0, 10),
      client_id: clientId,
      canal: "Vertex Rental Cars",
      status: "Pago",
      diferente: 0,
      numero_pedido_canal: session.id,
      frete_total: (session.shipping_cost?.amount_total ?? 0) / 100,
      custo_total_shipping: 0,
      impostos: (session.total_details?.amount_tax ?? 0) / 100,
      descontos: (session.total_details?.amount_discount ?? 0) / 100,
      total: (session.amount_total ?? 0) / 100,
      forma_pagamento: "Stripe",
      funds_available: true,
      country: address?.country || null,
      endereco_completo: enderecoCompleto,
    })
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = lineItems.data.map((item) => {
    const product = item.price?.product as Stripe.Product | undefined;
    return {
      order_id: order.id,
      product_id: product?.metadata?.product_id || null,
      quantidade: item.quantity ?? 1,
      preco_unitario: (item.price?.unit_amount ?? 0) / 100,
      custo_unitario: 0,
      imposto_unitario: 0,
      frete_unitario: 0,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;

  if (customerDetails?.email) {
    const itemsList = lineItems.data
      .map((item) => {
        const product = item.price?.product as Stripe.Product | undefined;
        return `${item.quantity}x ${product?.name ?? "Item"}`;
      })
      .join(", ");

    await sendAutomaticEmail(
      "order_confirmation",
      { email: customerDetails.email, name: customerDetails.name ?? undefined },
      {
        customer_name: customerDetails.name ?? "there",
        order_number: order.numero_pedido_canal ?? order.id,
        order_total: `$${((session.amount_total ?? 0) / 100).toFixed(2)}`,
        shipping_address: enderecoCompleto ?? "—",
        items_list: itemsList,
      }
    );
  }
}
