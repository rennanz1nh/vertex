import { NextRequest, NextResponse } from "next/server";
import { chargeDueBalances, expireUnpaidCheckouts, sendTomorrowDigest } from "@/lib/booking-payments";
import { BUSINESS_TIME_ZONE } from "@/lib/booking-payment-plan";
import { processDamageHolds } from "@/lib/damage-hold";

/**
 * Hourly (see vercel.json): releases checkouts left unpaid, then charges every balance due
 * today (5 days before pickup) to the saved card, retrying failed ones once every ~24h, and
 * runs the $99 damage-deposit holds (placed on pick-up day, released 3 days after return).
 * The 8am (Florida) run also sends the "tomorrow's pickups and returns" push.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const expired = await expireUnpaidCheckouts();
  const balances = await chargeDueBalances();
  const damageHolds = await processDamageHolds();
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, hour: "numeric", hour12: false }).format(new Date()));
  const digest = hour === 8 ? await sendTomorrowDigest() : null;
  return NextResponse.json({ ok: true, expired, balances, damageHolds, digest });
}
