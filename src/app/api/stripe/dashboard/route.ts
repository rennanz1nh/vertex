import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";

const LOOKBACK_DAYS = 30;

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ configured: false });
  }

  try {
    const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 60 * 60;

    const [charges, refunds, disputes, payouts] = await Promise.all([
      stripe.charges.list({ created: { gte: since }, limit: 100 }).autoPagingToArray({ limit: 500 }),
      stripe.refunds.list({ created: { gte: since }, limit: 100 }).autoPagingToArray({ limit: 500 }),
      stripe.disputes.list({ limit: 20 }),
      stripe.payouts.list({ limit: 10 }),
    ]);

    const succeededCharges = charges.filter((c) => c.status === "succeeded");
    const revenue = succeededCharges.reduce((sum, c) => sum + c.amount, 0) / 100;
    const refundedAmount = refunds.reduce((sum, r) => sum + r.amount, 0) / 100;

    // Daily revenue for the chart — bucketed by the charge's created date (UTC day).
    const byDay = new Map<string, number>();
    for (const c of succeededCharges) {
      const day = new Date(c.created * 1000).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + c.amount / 100);
    }
    const dailyRevenue = [...byDay.entries()]
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const openDisputes = disputes.data.filter((d) => !["won", "lost"].includes(d.status));

    return NextResponse.json({
      configured: true,
      lookbackDays: LOOKBACK_DAYS,
      revenue,
      chargeCount: succeededCharges.length,
      refundRate: succeededCharges.length ? refunds.length / succeededCharges.length : 0,
      disputeRate: succeededCharges.length ? disputes.data.length / succeededCharges.length : 0,
      refundedAmount,
      dailyRevenue,
      disputes: openDisputes.map((d) => ({
        id: d.id,
        amount: d.amount / 100,
        currency: d.currency,
        reason: d.reason,
        status: d.status,
        evidenceDueBy: d.evidence_details?.due_by ? new Date(d.evidence_details.due_by * 1000).toISOString() : null,
      })),
      payouts: payouts.data.map((p) => ({
        id: p.id,
        amount: p.amount / 100,
        currency: p.currency,
        status: p.status,
        arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
      })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
}
