import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAlertSettings, sendTestBookingAlert } from "@/lib/booking-alerts";

// GET: the recipients actually in effect (after fallbacks). POST: sends a sample alert.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  return NextResponse.json(await getAlertSettings());
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const results = await sendTestBookingAlert();
  return NextResponse.json({ results });
}
