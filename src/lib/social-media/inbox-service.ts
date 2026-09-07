import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { findVideoByHash, registerVideo } from "./video-service";
import { probeVideoFile, extractThumbnailFile, sha256OfBuffer, withTempVideoFile, type ProbedVideoInfo } from "./video-processing-server";
import type { VideoRecord } from "./types";

const BUCKET = "social-media";
const INBOX_PREFIX = "inbox";

/** Objects currently sitting in the inbox/ prefix — what the Phase 13 watcher cron polls instead of a real filesystem watch, since this stack has no always-on process. */
export async function listInboxObjects(limit = 20): Promise<string[]> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(INBOX_PREFIX, { limit, sortBy: { column: "created_at", order: "asc" } });
  if (error) throw new Error(error.message);
  // Supabase Storage's list() includes a placeholder entry for "the folder itself" on some
  // backends — filter to real objects (ones with an id) rather than assuming every row is a file.
  return (data ?? []).filter((entry) => entry.id).map((entry) => `${INBOX_PREFIX}/${entry.name}`);
}

export interface IngestResult {
  video: VideoRecord;
  duplicate: boolean;
}

/**
 * Downloads one inbox object, hashes it, and either recognizes it as a
 * duplicate (spec section 19 — never register the same video twice, even
 * if it's re-dropped) or registers it as a new video. ffmpeg/ffprobe
 * failures are non-fatal: the video still gets registered (source of
 * truth for dedup is the hash, not the thumbnail), just without
 * duration/dimensions/thumbnail until someone looks at it.
 */
export async function ingestInboxObject(objectPath: string): Promise<IngestResult> {
  const filename = objectPath.slice(INBOX_PREFIX.length + 1);

  const { data: blob, error: downloadError } = await supabaseAdmin.storage.from(BUCKET).download(objectPath);
  if (downloadError || !blob) throw new Error(`Failed to download ${objectPath}: ${downloadError?.message ?? "empty response"}`);
  const bytes = Buffer.from(await blob.arrayBuffer());

  const hash = sha256OfBuffer(bytes);

  const existing = await findVideoByHash(hash);
  if (existing) {
    // Already known under a different path — clear the re-dropped copy out of the inbox so the
    // watcher stops re-noticing it every tick, without touching the video that's already tracked.
    await supabaseAdmin.storage
      .from(BUCKET)
      .remove([objectPath])
      .catch((err) => console.error("Failed to remove duplicate inbox object", { objectPath, error: err }));
    return { video: existing, duplicate: true };
  }

  const extension = filename.includes(".") ? (filename.split(".").pop() ?? "mp4") : "mp4";
  let probed: ProbedVideoInfo = { durationSeconds: null, width: null, height: null, format: null };
  let thumbnailBytes: Buffer | null = null;
  try {
    await withTempVideoFile(bytes, extension, async (filePath) => {
      probed = await probeVideoFile(filePath);
      const seekAt = probed.durationSeconds ? Math.min(1, probed.durationSeconds / 2) : 0;
      thumbnailBytes = await extractThumbnailFile(filePath, seekAt);
    });
  } catch (err) {
    console.error("ffmpeg/ffprobe extraction failed for an inbox video — registering it without metadata/thumbnail", {
      objectPath,
      error: err instanceof Error ? err.message : err,
    });
  }

  const uniquePrefix = randomUUID();
  const registeredPath = `processing/${uniquePrefix}-${filename}`;
  const { error: moveError } = await supabaseAdmin.storage.from(BUCKET).move(objectPath, registeredPath);
  if (moveError) throw new Error(`Failed to move inbox object into processing: ${moveError.message}`);

  let thumbnailPath: string | null = null;
  if (thumbnailBytes) {
    thumbnailPath = `processing/${uniquePrefix}-thumb.jpg`;
    const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(thumbnailPath, thumbnailBytes, { contentType: "image/jpeg" });
    if (uploadError) {
      console.error("Failed to upload extracted thumbnail", { objectPath, error: uploadError.message });
      thumbnailPath = null;
    }
  }

  const { video, duplicate } = await registerVideo({
    filename,
    storagePath: registeredPath,
    thumbnailPath,
    sha256Hash: hash,
    durationSeconds: probed.durationSeconds,
    width: probed.width,
    height: probed.height,
    fileSize: bytes.length,
    format: probed.format,
    source: "watch_folder",
    uploadedBy: null,
  });

  return { video, duplicate };
}
