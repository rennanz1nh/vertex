import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const SHIPPO_API = "https://api.goshippo.com";

function shippoHeaders() {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function mapTransaction(tx: any) {
  return {
    object_id:             tx.object_id,
    tracking_number:       tx.tracking_number,
    label_url:             tx.label_url ?? null,
    commercial_invoice_url: tx.commercial_invoice_url ?? null,
    tracking_url_provider: tx.tracking_url_provider ?? null,
    status:                tx.status,
    carrier:               tx.rate?.provider ?? null,
    service:               tx.rate?.servicelevel?.name ?? null,
    amount:                tx.rate?.amount ?? null,
    currency:              tx.rate?.currency ?? null,
    created:               tx.object_created ?? null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  if (!process.env.SHIPPO_API_KEY) {
    return NextResponse.json({ error: "SHIPPO_API_KEY not configured", transactions: [] }, { status: 200 });
  }

  // Shippo caps each page at 100 results regardless of the "results" param, and paginates
  // via a full "next" URL — so older transactions never surfaced with a single fetch. Follow
  // "next" until it's null; MAX_PAGES is just a runaway-loop guard, not an expected limit.
  const results: any[] = [];
  let url: string | null = `${SHIPPO_API}/transactions?results=100&expand[]=rate`;
  let count = 0;
  const MAX_PAGES = 30;

  for (let page = 0; url && page < MAX_PAGES; page++) {
    const res = await fetch(url, { headers: shippoHeaders() });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: err, transactions: results.filter((tx) => tx.tracking_number).map(mapTransaction) },
        { status: 200 }
      );
    }

    const data = await res.json();
    results.push(...(data.results || []));
    count = data.count ?? count;
    url = data.next ?? null;
  }

  const transactions = results.filter((tx) => tx.tracking_number).map(mapTransaction);

  return NextResponse.json({ transactions, total: count || transactions.length });
}
