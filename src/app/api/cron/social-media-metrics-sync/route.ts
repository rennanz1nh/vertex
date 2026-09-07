import { NextRequest, NextResponse } from "next/server";
import { listDueMetricsSyncs, syncPublicationMetrics } from "@/lib/social-media/metrics-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH_SIZE = 10;

/**
 * Vercel Cron poll for social_post_metrics.next_sync_at <= now (see
 * vercel.json). Spec section 16's backoff schedule (10m/1h/6h/24h/48h/7d
 * then weekly) lives in metrics-service.ts — this route just drains
 * whatever is currently due, in a bounded batch per tick.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const due = await listDueMetricsSyncs(BATCH_SIZE);
    const results = [];
    for (const row of due) {
      results.push(await syncPublicationMetrics(row));
    }
    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
