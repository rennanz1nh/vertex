import { NextRequest, NextResponse } from "next/server";

/**
 * Daily fallback for order sync — TikTok Shop orders normally arrive via the
 * tiktok-shop-webhook push receiver in near-real-time, but webhook delivery isn't
 * guaranteed, so this calls the same tiktok-shop-sync edge function on a schedule
 * to catch anything a missed event would otherwise lose.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(`${supabaseUrl}/functions/v1/tiktok-shop-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
