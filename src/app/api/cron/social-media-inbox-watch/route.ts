import { NextRequest, NextResponse } from "next/server";
import { listInboxObjects, ingestInboxObject } from "@/lib/social-media/inbox-service";
import { getAutomationSettings, processVideoPipeline } from "@/lib/social-media/pipeline-service";

export const dynamic = "force-dynamic";
// Each video can involve a storage download, ffmpeg/ffprobe, a vision call, and a content-gen
// call — slower than the other social-media crons, hence the same 300s budget as publishing.
export const maxDuration = 300;

const BATCH_SIZE = 3;

/**
 * Vercel Cron poll of the social-media bucket's inbox/ prefix (see
 * vercel.json) — the "watched folder" from spec section 19, reinterpreted
 * for a stack with no always-on filesystem watcher (see the Storage-bucket
 * decision recorded in the Phase 3 migration). Detects, hashes/dedupes, and
 * runs the same process_video pipeline the MCP tool exposes, in a bounded
 * batch per tick so a pile of dropped videos drains gradually instead of
 * risking the time budget in one run.
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
    const settings = await getAutomationSettings();
    if (!settings.watch_folder_enabled) {
      return NextResponse.json({ ok: true, skipped: "watch_folder_enabled is off" });
    }

    const objectPaths = await listInboxObjects(BATCH_SIZE);
    const results = [];

    for (const objectPath of objectPaths) {
      try {
        const { video, duplicate } = await ingestInboxObject(objectPath);
        if (duplicate) {
          results.push({ object: objectPath, video_id: video.id, outcome: "duplicate" });
          continue;
        }

        const pipeline = await processVideoPipeline(video.id, { source: "cron" });
        results.push({
          object: objectPath,
          video_id: video.id,
          outcome: "ingested",
          analyzed: pipeline.analyzed,
          generated_platforms: pipeline.generatedPlatforms,
          created_publications: pipeline.createdPublicationIds,
          skipped_reasons: pipeline.skippedReasons,
        });
      } catch (err) {
        results.push({ object: objectPath, outcome: "failed", error: err instanceof Error ? err.message : "Unknown error" });
      }
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
