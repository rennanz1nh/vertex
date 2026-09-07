import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY não configurada." }, { status: 400 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const amount = Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency.toLowerCase() : "usd";
  const quantity = Math.max(1, Math.floor(Number(body.quantity)) || 1);

  if (!name) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
  if (!(amount > 0)) return NextResponse.json({ error: "Valor precisa ser maior que zero" }, { status: 400 });

  try {
    const link = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: Math.round(amount * 100),
            product_data: { name },
          },
          quantity,
        },
      ],
      automatic_tax: { enabled: true },
    });

    return NextResponse.json({ url: link.url, id: link.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
