import { NextRequest, NextResponse } from "next/server";

/**
 * Polls eBay for new/updated orders on a schedule — eBay has no push webhook in this
 * app, so this is the only way a new sale reaches our `orders` table (previously this
 * only ran when an admin clicked "Sincronizar eBay" by hand, so new sales — and the
 * "Vendas de Hoje" dashboard card / push notification tied to it — could go unnoticed
 * for days).
 *
 * The edge function rescans the full 90-day window every run (not incremental) and
 * makes 1-2 extra eBay API calls per order sequentially, so this can take a while once
 * order volume grows — give it real headroom instead of Vercel's ~15s default.
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

  const res = await fetch(`${supabaseUrl}/functions/v1/ebay-sync`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
