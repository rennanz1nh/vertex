import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

const SHIPPO_API = "https://api.goshippo.com";

// Orphans are transactions Shippo has but no order in our DB references — the exact class
// of bug that silently orphaned the Taha Aldawoud label (see /api/shippo/label's order_linked
// check). This lets staff manually re-link one to the right order after the fact.
const MAX_ORPHANS_TO_INSPECT = 30;

function shippoHeaders() {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function shippoGet(path: string) {
  try {
    const res = await fetch(`${SHIPPO_API}${path}`, { headers: shippoHeaders() });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  if (!process.env.SHIPPO_API_KEY) {
    return NextResponse.json({ error: "SHIPPO_API_KEY not configured", orphans: [] }, { status: 200 });
  }

  const [txRes, ordersRes] = await Promise.all([
    fetch(`${SHIPPO_API}/transactions?results=250&expand[]=rate`, { headers: shippoHeaders() }),
    getSupabase().from("orders").select("shipping_tracking").not("shipping_tracking", "is", null),
  ]);

  if (!txRes.ok) {
    return NextResponse.json({ error: await txRes.text(), orphans: [] }, { status: 200 });
  }

  const txData = await txRes.json();
  const linkedTrackingNumbers = new Set((ordersRes.data ?? []).map((o: { shipping_tracking: string }) => o.shipping_tracking));

  const candidates = ((txData.results ?? []) as any[])
    .filter((tx) => tx.tracking_number && tx.status === "SUCCESS" && !linkedTrackingNumbers.has(tx.tracking_number))
    // Most recently purchased first — a manually-triggered re-link is almost always for a
    // recent order, and this also bounds how many expensive per-transaction lookups we do.
    .sort((a, b) => (b.object_created ?? "").localeCompare(a.object_created ?? ""))
    .slice(0, MAX_ORPHANS_TO_INSPECT);

  const orphans = await Promise.all(
    candidates.map(async (tx) => {
      const rateId = typeof tx.rate === "string" ? tx.rate : tx.rate?.object_id ?? null;
      const rate = rateId ? await shippoGet(`/rates/${rateId}`) : null;
      const shipmentId = typeof rate?.shipment === "string" ? rate.shipment : rate?.shipment?.object_id ?? null;
      const shipment = shipmentId ? await shippoGet(`/shipments/${shipmentId}`) : null;
      const addressTo = shipment?.address_to;

      return {
        tracking_number: tx.tracking_number as string,
        carrier: tx.rate?.provider ?? null,
        service: tx.rate?.servicelevel?.name ?? null,
        amount: tx.rate?.amount ?? null,
        currency: tx.rate?.currency ?? null,
        created: tx.object_created ?? null,
        address_to: addressTo
          ? { name: addressTo.name ?? null, city: addressTo.city ?? null, country: addressTo.country ?? null, zip: addressTo.zip ?? null }
          : null,
      };
    })
  );

  return NextResponse.json({ orphans });
}
