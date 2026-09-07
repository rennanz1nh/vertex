import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAuditEvent } from "@/lib/audit-log";
import type { ActionActor, VideoRecord, VideoStatus } from "./types";

const VIDEO_COLUMNS =
  "id, filename, storage_bucket, storage_path, thumbnail_path, sha256_hash, duration_seconds, width, height, file_size, format, source, status, uploaded_by, created_at, updated_at";

/** Purely organizational — mirrors the spec's inbox/processing/approved/published/failed/archive folders as key prefixes within the one 'social-media' bucket. Never load-bearing: social_videos.status is the actual source of truth every query filters on. */
export function statusToStoragePrefix(status: VideoStatus): string {
  switch (status) {
    case "NEW":
    case "ANALYZING":
    case "READY_FOR_REVIEW":
      return "processing";
    case "APPROVED":
    case "SCHEDULED":
    case "PUBLISHING":
      return "approved";
    case "PUBLISHED":
      return "published";
    case "REJECTED":
    case "FAILED":
      return "failed";
    default:
      return "processing";
  }
}

export async function listVideos(params: { status?: VideoStatus; limit?: number } = {}): Promise<VideoRecord[]> {
  let query = supabaseAdmin
    .from("social_videos")
    .select(VIDEO_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 25);
  if (params.status) query = query.eq("status", params.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as VideoRecord[];
}

export async function getVideo(id: string): Promise<VideoRecord | null> {
  const { data, error } = await supabaseAdmin.from("social_videos").select(VIDEO_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as VideoRecord | null;
}

export async function findVideoByHash(sha256Hash: string): Promise<VideoRecord | null> {
  const { data, error } = await supabaseAdmin.from("social_videos").select(VIDEO_COLUMNS).eq("sha256_hash", sha256Hash).maybeSingle();
  if (error) throw new Error(error.message);
  return data as VideoRecord | null;
}

export interface RegisterVideoParams {
  filename: string;
  storagePath: string;
  thumbnailPath?: string | null;
  sha256Hash: string;
  durationSeconds?: number | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
  format?: string | null;
  source: "manual_upload" | "watch_folder";
  uploadedBy?: string | null;
}

/** Idempotent by design (spec section 19: "não duplicar o mesmo vídeo caso ele permaneça na pasta"): registering a hash that's already known returns the existing row instead of inserting a second one. */
export async function registerVideo(params: RegisterVideoParams): Promise<{ video: VideoRecord; duplicate: boolean }> {
  const existing = await findVideoByHash(params.sha256Hash);
  if (existing) return { video: existing, duplicate: true };

  const { data, error } = await supabaseAdmin
    .from("social_videos")
    .insert({
      filename: params.filename,
      storage_bucket: "social-media",
      storage_path: params.storagePath,
      thumbnail_path: params.thumbnailPath ?? null,
      sha256_hash: params.sha256Hash,
      duration_seconds: params.durationSeconds ?? null,
      width: params.width ?? null,
      height: params.height ?? null,
      file_size: params.fileSize ?? null,
      format: params.format ?? null,
      source: params.source,
      status: "NEW",
      uploaded_by: params.uploadedBy ?? null,
    })
    .select(VIDEO_COLUMNS)
    .single();
  if (error) {
    // A concurrent request could win the unique(sha256_hash) race between our findVideoByHash check and this insert — treat that the same as a normal duplicate rather than surfacing a 500.
    if (error.code === "23505") {
      const raceWinner = await findVideoByHash(params.sha256Hash);
      if (raceWinner) return { video: raceWinner, duplicate: true };
    }
    throw new Error(error.message);
  }

  const video = data as VideoRecord;
  await logAuditEvent({
    tableName: "social_videos",
    recordId: video.id,
    action: "video_registered",
    userId: params.uploadedBy ?? null,
    source: params.source === "watch_folder" ? "system" : "hub_ui",
    newValues: { filename: video.filename, source: video.source },
  });
  return { video, duplicate: false };
}

export async function moveVideo(id: string, newStatus: VideoStatus, actor: ActionActor): Promise<VideoRecord> {
  const current = await getVideo(id);
  if (!current) throw new Error("Video not found");

  const { data, error } = await supabaseAdmin
    .from("social_videos")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(VIDEO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  const fromPrefix = statusToStoragePrefix(current.status);
  const toPrefix = statusToStoragePrefix(newStatus);
  if (fromPrefix !== toPrefix) {
    const fromPath = current.storage_path;
    const toPath = fromPath.replace(`${fromPrefix}/`, `${toPrefix}/`);
    const { error: moveError } = await supabaseAdmin.storage.from("social-media").move(fromPath, toPath);
    if (!moveError) {
      await supabaseAdmin.from("social_videos").update({ storage_path: toPath }).eq("id", id);
    } else {
      // Non-fatal: the DB status (the real source of truth) already moved. Storage layout staying
      // out of sync is a cosmetic inconvenience for someone browsing the bucket by hand, not a
      // functional break, so we log it rather than fail the whole status change over it.
      console.error("Failed to move video storage object between prefixes", { id, fromPath, toPath, error: moveError.message });
    }
  }

  await logAuditEvent({
    tableName: "social_videos",
    recordId: id,
    action: "video_status_changed",
    userId: actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
    oldValues: { status: current.status },
    newValues: { status: newStatus },
  });

  return data as VideoRecord;
}

export type DeleteVideoResult = { success: true } | { success: false; error: string };

export async function deleteVideo(id: string, actor: ActionActor): Promise<DeleteVideoResult> {
  const video = await getVideo(id);
  if (!video) return { success: false, error: "Video not found" };

  const { error } = await supabaseAdmin.from("social_videos").delete().eq("id", id);
  if (error) {
    // social_publications.video_id has no ON DELETE CASCADE (deliberately — see migration):
    // a video with real publication history must not be silently deletable.
    if (error.code === "23503") {
      return { success: false, error: "Cannot delete a video that has publications — reject or archive it instead" };
    }
    return { success: false, error: error.message };
  }

  const objectsToRemove = [video.storage_path, video.thumbnail_path].filter((p): p is string => !!p);
  if (objectsToRemove.length > 0) {
    const { error: removeError } = await supabaseAdmin.storage.from("social-media").remove(objectsToRemove);
    if (removeError) {
      console.error("Failed to remove video storage objects after DB delete", { id, error: removeError.message });
    }
  }

  await logAuditEvent({
    tableName: "social_videos",
    recordId: id,
    action: "video_deleted",
    userId: actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
    oldValues: { filename: video.filename, status: video.status },
  });

  return { success: true };
}

const SIGNED_URL_TTL_SECONDS = 60 * 10;
// Publishing hands this URL to Instagram/TikTok for them to fetch asynchronously
// (container processing, PULL_FROM_URL) — a much longer TTL than the Hub preview
// needs, so a busy platform queue can't lose the video to an expired link mid-fetch.
const PUBLISH_SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function getSignedVideoUrl(video: VideoRecord): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from(video.storage_bucket).createSignedUrl(video.storage_path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function getSignedVideoUrlForPublish(video: VideoRecord): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from(video.storage_bucket).createSignedUrl(video.storage_path, PUBLISH_SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

export async function getSignedThumbnailUrl(video: VideoRecord): Promise<string | null> {
  if (!video.thumbnail_path) return null;
  const { data } = await supabaseAdmin.storage.from(video.storage_bucket).createSignedUrl(video.thumbnail_path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}
