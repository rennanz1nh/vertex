import { NextRequest, NextResponse } from "next/server";
import { chargeDueBalances, expireUnpaidCheckouts } from "@/lib/booking-payments";

/**
 * Hourly (see vercel.json): releases checkouts left unpaid, then charges every balance due
 * today (5 days before pickup) to the saved card, retrying failed ones once every ~24h.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireUnpaidCheckouts();
  const balances = await chargeDueBalances();
  return NextResponse.json({ ok: true, expired, balances });
}
