import { NextRequest, NextResponse } from "next/server";

/**
 * Polls Amazon for new/updated orders on a schedule — same fallback role as
 * /api/cron/ebay-sync: previously this only ran when an admin clicked "Sincronizar
 * Amazon" by hand, so new sales could sit unsynced for days.
 *
 * SP-API has tight per-endpoint rate limits and this makes several sequential calls
 * per order (items, restricted data token, address, buyer info) — give it real
 * headroom instead of Vercel's ~15s default.
 */
export const maxDuration = 300;

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

  const res = await fetch(`${supabaseUrl}/functions/v1/amazon-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
