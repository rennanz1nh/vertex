import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const SHIPPO_API = "https://api.goshippo.com";

function shippoHeaders() {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function shippoGet(path: string) {
  try {
    const res = await fetch(`${SHIPPO_API}${path}`, { headers: shippoHeaders() });
    if (!res.ok) return { _error: await res.text(), _status: res.status };
    return await res.json();
  } catch (e) {
    return { _error: String(e) };
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const tracking = searchParams.get("tracking");
  const carrier = (searchParams.get("carrier") || "usps").toLowerCase();

  if (!tracking) {
    return NextResponse.json({ error: "tracking required" }, { status: 400 });
  }

  // Shippo's /transactions list endpoint doesn't actually filter server-side by
  // tracking_number — that query param is silently ignored, so it always returned the
  // same handful of most-recently-created transactions no matter which tracking number
  // was requested (every order's "Valor pago pelo envio" was showing the same amount).
  // Fetch a wide-enough page and match by tracking_number client-side instead, the same
  // way transactions-list already does for the Pedidos/Shipping's table columns.
  const [trackingData, transactionsData] = await Promise.all([
    shippoGet(`/tracks/${carrier}/${encodeURIComponent(tracking)}`),
    shippoGet(`/transactions?results=250&expand[]=rate`),
  ]);

  const transaction =
    (transactionsData?.results ?? []).find((tx: any) => tx.tracking_number === tracking) ?? null;

  let rateData: any = null;
  let shipmentData: any = null;

  if (transaction?.rate) {
    // expand[]=rate above already gives the full rate object — only fall back to a
    // separate fetch if Shippo returned just a bare rate ID for some reason.
    rateData =
      typeof transaction.rate === "string"
        ? await shippoGet(`/rates/${transaction.rate}`)
        : transaction.rate;

    const shipmentId =
      typeof rateData?.shipment === "string"
        ? rateData.shipment
        : rateData?.shipment?.object_id ?? null;

    if (shipmentId) {
      shipmentData = await shippoGet(`/shipments/${shipmentId}`);
    }
  }

  return NextResponse.json({
    tracking: trackingData,
    transaction,
    rate: rateData,
    shipment: shipmentData,
  });
}
