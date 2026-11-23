import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { cancelBooking } from "@/lib/booking-refunds";

// Admin "Cancelar reserva" for website bookings. Admins only (not operador): it can move
// money back to the customer's card.
// Body: { refund: "full" | "partial" | "none", amount?: number (USD, for partial), note?: string }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(request);
  if (!auth.ok) return NextResponse.json({ ok: false, reason: "Unauthorized" }, { status: auth.status });
  if (auth.role !== "admin") return NextResponse.json({ ok: false, reason: "Só o admin pode cancelar reservas." }, { status: 403 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { refund?: unknown; amount?: unknown; note?: unknown };
  const refund = body.refund === "full" || body.refund === "partial" || body.refund === "none" ? body.refund : null;
  if (!refund) return NextResponse.json({ ok: false, reason: "Escolha o reembolso: total, parcial ou nenhum." }, { status: 400 });
  if (refund !== "none" && !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, reason: "STRIPE_SECRET_KEY não configurada." }, { status: 400 });
  }
  let amountCents: number | undefined;
  if (refund === "partial") {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ ok: false, reason: "Valor inválido." }, { status: 400 });
    amountCents = Math.round(n * 100);
  }
  try {
    const result = await cancelBooking(id, { refund, amountCents, note: typeof body.note === "string" ? body.note : undefined });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : "Stripe error" }, { status: 502 });
  }
}
