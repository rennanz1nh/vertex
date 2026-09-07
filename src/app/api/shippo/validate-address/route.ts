import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

const SHIPPO_API = "https://api.goshippo.com";

function shippoHeaders() {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// Lightweight standalone address check — hits Shippo's Addresses endpoint directly (validate:
// true) instead of creating a full shipment+parcel just to validate, since box/weight aren't
// known yet at this point in the flow (see /api/shippo/label for the shipment-based version
// used right before buying a label, which validates as a side effect of getting rates).
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const address = await req.json();
  if (!address.street1 || !address.city || !address.zip) {
    return NextResponse.json({ error: "Rua, cidade e CEP são obrigatórios" }, { status: 400 });
  }

  const res = await fetch(`${SHIPPO_API}/addresses`, {
    method: "POST",
    headers: shippoHeaders(),
    body: JSON.stringify({ ...address, validate: true }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Shippo address error: ${err}` }, { status: 502 });
  }

  const data = await res.json();
  const validationResults = data.validation_results ?? null;

  return NextResponse.json({
    is_valid: validationResults?.is_valid ?? null,
    messages: (validationResults?.messages ?? []).map((m: { text?: string }) => m.text).filter(Boolean),
  });
}
