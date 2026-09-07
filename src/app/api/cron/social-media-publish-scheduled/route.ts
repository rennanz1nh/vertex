import { NextRequest, NextResponse } from "next/server";
import { listDuePublications } from "@/lib/social-media/publication-service";
import { publishPublication } from "@/lib/social-media/publish-service";

export const dynamic = "force-dynamic";
// Publishing polls the platform for up to ~60s per item (see /api/mcp/route.ts) — with a
// batch of a few items per run this needs real headroom, not the 30s other crons use.
export const maxDuration = 300;

const BATCH_SIZE = 5;

/**
 * Vercel Cron poll for scheduled_at <= now (see vercel.json). Spec section
 * 15: scheduling must not depend on Claude or a browser tab staying open —
 * this is that background worker. Processes a bounded batch per tick so a
 * large backlog drains over several runs instead of risking the time
 * budget in one. publishPublication's own atomic claim (status must still
 * be SCHEDULED when the UPDATE runs) means an overlapping run — the
 * previous tick still finishing a slow publish when the next one fires —
 * can't publish the same row twice.
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
    const due = await listDuePublications(BATCH_SIZE);
    const results: { publication_id: string; outcome: string; error: string | null }[] = [];

    for (const publication of due) {
      const result = await publishPublication(publication.id, { source: "cron" });
      results.push({ publication_id: publication.id, outcome: result.outcome, error: result.errorMessage ?? null });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
