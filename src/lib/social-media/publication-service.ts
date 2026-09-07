import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAuditEvent } from "@/lib/audit-log";
import { getVideo, getSignedThumbnailUrl, getSignedVideoUrl } from "./video-service";
import { getPlatformContent } from "./content-generation";
import type { ActionActor, ApprovalStatus, PublicationRecord, PublicationStatus, SocialPlatform } from "./types";

export const PUBLICATION_COLUMNS =
  "id, video_id, platform, account_id, platform_content_id, idempotency_key, status, approval_status, approved_by, approved_at, auto_approved, rejection_reason, scheduled_at, timezone, published_at, platform_post_id, permalink, error_code, error_message, platform_response, retry_count, last_attempt_at, created_by, created_at, updated_at";

// A publication in any of these statuses represents a live, still-relevant
// intent to post — a repeat create_publication call for the same
// (video, platform, account) returns this one instead of making a duplicate
// approval request for content that's already in flight.
const NON_TERMINAL_STATUSES: PublicationStatus[] = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHING", "PUBLISHED"];

export async function getPublication(id: string): Promise<PublicationRecord | null> {
  const { data, error } = await supabaseAdmin.from("social_publications").select(PUBLICATION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as PublicationRecord | null;
}

export async function listPublications(
  params: { status?: PublicationStatus; approvalStatus?: ApprovalStatus; videoId?: string; limit?: number } = {}
): Promise<PublicationRecord[]> {
  let query = supabaseAdmin
    .from("social_publications")
    .select(PUBLICATION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(params.limit ?? 25);
  if (params.status) query = query.eq("status", params.status);
  if (params.approvalStatus) query = query.eq("approval_status", params.approvalStatus);
  if (params.videoId) query = query.eq("video_id", params.videoId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as PublicationRecord[];
}

export interface CreatePublicationResult {
  publication: PublicationRecord;
  isExisting: boolean;
}

/**
 * Creates a publication in PENDING_APPROVAL — spec section 4: every mode
 * (MANUAL, APPROVAL, AUTO) funnels through human review by default here;
 * the AUTO-publish bypass (spec section 30) is a distinct path the Phase 13
 * automation adds on top of this, not a branch inside it.
 */
export async function createPublication(params: {
  videoId: string;
  platform: SocialPlatform;
  accountId: string;
  actor: ActionActor;
}): Promise<CreatePublicationResult> {
  const video = await getVideo(params.videoId);
  if (!video) throw new Error("Video not found");

  const { data: existingRows, error: existingError } = await supabaseAdmin
    .from("social_publications")
    .select(PUBLICATION_COLUMNS)
    .eq("video_id", params.videoId)
    .eq("platform", params.platform)
    .eq("account_id", params.accountId)
    .in("status", NON_TERMINAL_STATUSES)
    .limit(1);
  if (existingError) throw new Error(existingError.message);
  if (existingRows && existingRows.length > 0) {
    return { publication: existingRows[0] as PublicationRecord, isExisting: true };
  }

  const content = await getPlatformContent(params.videoId, params.platform);
  if (!content) {
    throw new Error(`No ${params.platform} content generated for this video yet — run generate_platform_content first`);
  }

  const { data: account, error: accountError } = await supabaseAdmin
    .from("social_media_accounts")
    .select("id, platform")
    .eq("id", params.accountId)
    .maybeSingle();
  if (accountError) throw new Error(accountError.message);
  if (!account) throw new Error("Account not found");
  if (account.platform !== params.platform) {
    throw new Error(`Account platform (${account.platform}) does not match requested platform (${params.platform})`);
  }

  const createdBy = params.actor.source === "hub_ui" || params.actor.source === "mcp_tool" ? params.actor.userId : null;

  const { data: inserted, error } = await supabaseAdmin
    .from("social_publications")
    .insert({
      video_id: params.videoId,
      platform: params.platform,
      account_id: params.accountId,
      platform_content_id: content.id,
      idempotency_key: randomUUID(),
      status: "PENDING_APPROVAL",
      approval_status: "PENDING",
      created_by: createdBy,
    })
    .select(PUBLICATION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  await logAuditEvent({
    tableName: "social_publications",
    recordId: inserted.id,
    action: "publication_created",
    userId: createdBy,
    source: params.actor.source,
    mcpToolName: params.actor.source === "mcp_tool" ? params.actor.mcpToolName : undefined,
    newValues: { video_id: params.videoId, platform: params.platform, account_id: params.accountId },
  });

  return { publication: inserted as PublicationRecord, isExisting: false };
}

export interface PublicationPreview {
  publication: PublicationRecord;
  video: { id: string; filename: string; videoUrl: string | null; thumbnailUrl: string | null };
  content: { title: string; caption: string; hashtags: string[]; extra: Record<string, unknown> } | null;
  account: { id: string; account_name: string | null; avatar_url: string | null } | null;
}

/** Spec section 14: everything the approval preview screen needs, assembled in one call. */
export async function previewPublication(id: string): Promise<PublicationPreview | null> {
  const publication = await getPublication(id);
  if (!publication) return null;

  const video = await getVideo(publication.video_id);
  const [videoUrl, thumbnailUrl] = video ? await Promise.all([getSignedVideoUrl(video), getSignedThumbnailUrl(video)]) : [null, null];

  let content: PublicationPreview["content"] = null;
  if (publication.platform_content_id) {
    const { data } = await supabaseAdmin
      .from("social_platform_content")
      .select("title, caption, hashtags, extra")
      .eq("id", publication.platform_content_id)
      .maybeSingle();
    if (data) content = data;
  }

  const { data: account } = await supabaseAdmin
    .from("social_media_accounts")
    .select("id, account_name, avatar_url")
    .eq("id", publication.account_id)
    .maybeSingle();

  return {
    publication,
    video: { id: publication.video_id, filename: video?.filename ?? "", videoUrl, thumbnailUrl },
    content,
    account: account ?? null,
  };
}

async function requirePendingApproval(id: string): Promise<PublicationRecord> {
  const publication = await getPublication(id);
  if (!publication) throw new Error("Publication not found");
  if (publication.approval_status !== "PENDING") {
    throw new Error(`Publication is already ${publication.approval_status.toLowerCase()} — nothing to do`);
  }
  return publication;
}

/** The human-review approval path — see autoApprovePublication below for the separate, narrowly-gated AUTO-mode path. This one always requires a real user. */
export async function approvePublication(id: string, actor: ActionActor): Promise<PublicationRecord> {
  await requirePendingApproval(id);
  const userId = actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null;
  if (!userId) throw new Error("Approval requires a real user — automated processes cannot approve their own publications");

  const { data, error } = await supabaseAdmin
    .from("social_publications")
    .update({
      approval_status: "APPROVED",
      approved_by: userId,
      approved_at: new Date().toISOString(),
      status: "APPROVED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(PUBLICATION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  await logAuditEvent({
    tableName: "social_publications",
    recordId: id,
    action: "publication_approved",
    userId,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
  });

  return data as PublicationRecord;
}

/**
 * System-triggered approval for AUTO publish mode — deliberately NOT
 * reachable from approve_publication or any human-facing path. Only ever
 * called by auto-publish-service.ts, after it has already verified
 * auto_publish_enabled globally AND auto_publish_authorized on this
 * specific account. approved_by stays null (no human reviewed this) and
 * auto_approved is set true, so it's always visibly distinguishable from a
 * real approval rather than looking like an unattributed one. Uses the
 * same atomic-claim shape as publish-service.ts's UPDATE ... WHERE: only
 * transitions a row that is still genuinely PENDING, so a race against a
 * human approving/rejecting the same publication can't double-act on it —
 * it returns null instead, which the caller treats as "someone else
 * already handled it," not an error.
 */
export async function autoApprovePublication(id: string): Promise<PublicationRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("social_publications")
    .update({
      approval_status: "APPROVED",
      approved_by: null,
      approved_at: new Date().toISOString(),
      status: "APPROVED",
      auto_approved: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("approval_status", "PENDING")
    .select(PUBLICATION_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  await logAuditEvent({
    tableName: "social_publications",
    recordId: id,
    action: "publication_auto_approved",
    userId: null,
    source: "system",
    newValues: { reason: "auto_publish_enabled + account.auto_publish_authorized" },
  });

  return data as PublicationRecord;
}

export async function rejectPublication(id: string, reason: string, actor: ActionActor): Promise<PublicationRecord> {
  await requirePendingApproval(id);
  const userId = actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null;

  const { data, error } = await supabaseAdmin
    .from("social_publications")
    .update({
      approval_status: "REJECTED",
      rejection_reason: reason,
      status: "REJECTED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(PUBLICATION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  await logAuditEvent({
    tableName: "social_publications",
    recordId: id,
    action: "publication_rejected",
    userId,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
    newValues: { rejection_reason: reason },
  });

  return data as PublicationRecord;
}

const SCHEDULABLE_STATUSES: PublicationStatus[] = ["APPROVED", "SCHEDULED", "FAILED"];

/** Spec section 15: schedule an already-approved publication for a future time. Never schedules unapproved content — same approval gate publishing itself enforces. */
export async function schedulePublication(id: string, scheduledAt: string, timezone: string, actor: ActionActor): Promise<PublicationRecord> {
  const publication = await getPublication(id);
  if (!publication) throw new Error("Publication not found");
  if (publication.approval_status !== "APPROVED") {
    throw new Error("Only approved publications can be scheduled — approve it first.");
  }
  if (!SCHEDULABLE_STATUSES.includes(publication.status)) {
    throw new Error(`Cannot schedule a publication that is currently ${publication.status}`);
  }

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("scheduled_at is not a valid date/time");
  if (when.getTime() <= Date.now()) throw new Error("scheduled_at must be in the future");

  const { data, error } = await supabaseAdmin
    .from("social_publications")
    .update({ status: "SCHEDULED", scheduled_at: when.toISOString(), timezone: timezone || "UTC", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PUBLICATION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  await logAuditEvent({
    tableName: "social_publications",
    recordId: id,
    action: "publication_scheduled",
    userId: actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
    newValues: { scheduled_at: when.toISOString(), timezone: timezone || "UTC" },
  });

  return data as PublicationRecord;
}

/** Un-schedules — the publication goes back to plain APPROVED, still publishable manually or reschedulable later. Does not reject or delete it. */
export async function cancelScheduledPublication(id: string, actor: ActionActor): Promise<PublicationRecord> {
  const publication = await getPublication(id);
  if (!publication) throw new Error("Publication not found");
  if (publication.status !== "SCHEDULED") {
    throw new Error(`Publication is not scheduled (currently ${publication.status}) — nothing to cancel`);
  }

  const { data, error } = await supabaseAdmin
    .from("social_publications")
    .update({ status: "APPROVED", scheduled_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PUBLICATION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  await logAuditEvent({
    tableName: "social_publications",
    recordId: id,
    action: "publication_schedule_cancelled",
    userId: actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
  });

  return data as PublicationRecord;
}

/** Publications whose scheduled time has arrived — what the Phase 11 cron worker polls. Bounded by `limit` so one run only ever claims a small batch. */
export async function listDuePublications(limit = 5): Promise<PublicationRecord[]> {
  const { data, error } = await supabaseAdmin
    .from("social_publications")
    .select(PUBLICATION_COLUMNS)
    .eq("status", "SCHEDULED")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as PublicationRecord[];
}
