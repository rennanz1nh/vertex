import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";

// Orders paid through our own Checkout store `numero_pedido_canal` as the Checkout
// Session ID (see fulfillOrder in the webhook route) — the session, not the order,
// is what actually holds the PaymentIntent a refund has to reference.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY não configurada." }, { status: 400 });
  }

  const { sessionId } = await request.json();
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!paymentIntentId) {
      return NextResponse.json({ error: "Esse pedido não tem um pagamento do Stripe associado (ainda não foi pago ou não veio do checkout online)." }, { status: 400 });
    }

    const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
    return NextResponse.json({ refundId: refund.id, amount: refund.amount / 100, status: refund.status });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
