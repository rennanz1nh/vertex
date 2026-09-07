import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ configured: false });
  }

  try {
    const [account, taxRegistrations, webhooks] = await Promise.all([
      stripe.accounts.retrieveCurrent(),
      stripe.tax.registrations.list({ limit: 10 }),
      stripe.webhookEndpoints.list({ limit: 10 }),
    ]);

    return NextResponse.json({
      configured: true,
      businessName: account.business_profile?.name ?? null,
      email: account.email ?? null,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      taxRegistrationsCount: taxRegistrations.data.filter((r) => r.status === "active").length,
      webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
      webhooks: webhooks.data.map((w) => ({ url: w.url, status: w.status, events: w.enabled_events.length })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
}
