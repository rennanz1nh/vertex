import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const SHIPPO_API = "https://api.goshippo.com";

function shippoHeaders() {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const carrier = (searchParams.get("carrier") || "usps").toLowerCase();
  const tracking = searchParams.get("tracking");

  if (!tracking) {
    return NextResponse.json({ error: "tracking required" }, { status: 400 });
  }

  const res = await fetch(`${SHIPPO_API}/tracks/${carrier}/${encodeURIComponent(tracking)}`, {
    headers: shippoHeaders(),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { carrier, tracking_number } = await req.json();

  if (!carrier || !tracking_number) {
    return NextResponse.json({ error: "carrier and tracking_number required" }, { status: 400 });
  }

  const res = await fetch(`${SHIPPO_API}/tracks`, {
    method: "POST",
    headers: shippoHeaders(),
    body: JSON.stringify({ carrier: carrier.toLowerCase(), tracking_number }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
