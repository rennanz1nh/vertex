import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/admin-auth";
import { refundablePayments, refundBooking } from "@/lib/booking-refunds";

// Admin "Reembolsar" for website bookings paid through Stripe. Admins only (not operador),
// since it moves money back to the customer's card.
async function gate(request: NextRequest) {
  const auth = await requireStaff(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  if (auth.role !== "admin") return NextResponse.json({ error: "Só o admin pode reembolsar." }, { status: 403 });
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "STRIPE_SECRET_KEY não configurada." }, { status: 400 });
  return null;
}

/** How much is still refundable, per payment (deposit / balance). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await gate(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const payments = await refundablePayments(id);
    if (!payments) return NextResponse.json({ error: "Reserva não encontrada." }, { status: 404 });
    const total = payments.reduce((s, p) => s + p.refundableCents, 0);
    return NextResponse.json({ payments, refundable: total / 100 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Stripe error" }, { status: 502 });
  }
}

/** Body: { amount?: number (USD; omitted = full refund), note?: string }. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await gate(request);
  if (denied) return denied;
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { amount?: unknown; note?: unknown };
  let amountCents: number | undefined;
  if (body.amount !== undefined && body.amount !== null && body.amount !== "") {
    const n = Number(body.amount);
    if (!Number.isFinite(n) || n <= 0) return NextResponse.json({ ok: false, reason: "Valor inválido." }, { status: 400 });
    amountCents = Math.round(n * 100);
  }
  try {
    const result = await refundBooking(id, { amountCents, note: typeof body.note === "string" ? body.note : undefined });
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : "Stripe error" }, { status: 502 });
  }
}
