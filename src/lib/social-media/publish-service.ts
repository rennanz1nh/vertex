import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAuditEvent } from "@/lib/audit-log";
import { getVideo, getSignedVideoUrlForPublish, moveVideo } from "./video-service";
import { getPublication, PUBLICATION_COLUMNS } from "./publication-service";
import { createInitialMetricsRow } from "./metrics-service";
import { getPlatformAdapter } from "./platforms/registry";
import type { PlatformAccount, PublishContent } from "./platforms/types";
import type { ActionActor, PublicationRecord } from "./types";

// Publications a publish attempt is allowed to start from: a fresh approval,
// a due scheduled post (Phase 11's cron calls publishPublication directly
// once scheduled_at has passed), or a retry of a previous failure. Anything
// else (DRAFT, PENDING_APPROVAL, PUBLISHING, PUBLISHED, CANCELLED, REJECTED)
// is not claimable — see the atomic UPDATE below.
const CLAIMABLE_STATUSES = ["APPROVED", "SCHEDULED", "FAILED"];

class PublishInputError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function actorUserId(actor: ActionActor): string | null {
  return actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null;
}

function actorMcpToolName(actor: ActionActor): string | undefined {
  return actor.source === "mcp_tool" ? actor.mcpToolName : undefined;
}

async function markFailed(
  id: string,
  params: { errorCode: string; errorMessage: string; platformResponse?: unknown; incrementRetry?: boolean }
): Promise<PublicationRecord> {
  const update: Record<string, unknown> = {
    status: "FAILED",
    error_code: params.errorCode,
    error_message: params.errorMessage,
    updated_at: new Date().toISOString(),
  };
  if (params.platformResponse !== undefined) update.platform_response = params.platformResponse;
  if (params.incrementRetry) {
    const current = await getPublication(id);
    update.retry_count = (current?.retry_count ?? 0) + 1;
  }
  const { data, error } = await supabaseAdmin.from("social_publications").update(update).eq("id", id).select(PUBLICATION_COLUMNS).single();
  if (error) throw new Error(error.message);
  return data as PublicationRecord;
}

async function loadPlatformAccount(accountId: string): Promise<{ account: PlatformAccount; canPublish: boolean } | null> {
  const { data, error } = await supabaseAdmin
    .from("social_media_accounts")
    .select("id, platform, account_id, access_token, refresh_token, expires_at, can_publish")
    .eq("id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    account: {
      id: data.id,
      platform: data.platform,
      account_id: data.account_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    },
    canPublish: data.can_publish,
  };
}

export interface PublishPublicationResult {
  publication: PublicationRecord;
  outcome: "published" | "already_published" | "already_in_progress" | "failed";
  errorMessage?: string;
}

/**
 * Actually calls out to the platform. Spec sections 26/27: never publish the
 * same video twice, and never bypass approval. Both are enforced here, not
 * just at create_publication time — this is the function that makes the
 * real network call, so it's the one that has to be safe to call twice.
 */
export async function publishPublication(id: string, actor: ActionActor): Promise<PublishPublicationResult> {
  const publication = await getPublication(id);
  if (!publication) throw new Error("Publication not found");

  if (publication.approval_status !== "APPROVED") {
    throw new Error("This publication has not been approved yet. Publishing tools never bypass human approval — approve it first.");
  }

  if (publication.status === "PUBLISHED") {
    return { publication, outcome: "already_published" };
  }

  const adapter = getPlatformAdapter(publication.platform);
  if (!adapter) {
    const failed = await markFailed(id, {
      errorCode: "platform_not_supported",
      errorMessage: `Publishing to '${publication.platform}' isn't implemented yet. Only Instagram and TikTok support publishing right now.`,
    });
    return { publication: failed, outcome: "failed", errorMessage: failed.error_message ?? undefined };
  }

  // Atomic claim: only the caller whose UPDATE actually matches a row gets to
  // proceed. A concurrent second call (retry, double-click, race between the
  // Hub and Claude) matches zero rows and falls through to "already in
  // progress" / "already published" instead of firing a second platform call.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("social_publications")
    .update({ status: "PUBLISHING", last_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", CLAIMABLE_STATUSES)
    .select(PUBLICATION_COLUMNS)
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) {
    const current = await getPublication(id);
    if (!current) throw new Error("Publication not found");
    return { publication: current, outcome: current.status === "PUBLISHED" ? "already_published" : "already_in_progress" };
  }
  const claimedPublication = claimed as PublicationRecord;

  await logAuditEvent({
    tableName: "social_publications",
    recordId: id,
    action: "publication_publish_attempted",
    userId: actorUserId(actor),
    source: actor.source,
    mcpToolName: actorMcpToolName(actor),
  });

  // Best-effort — a video with multiple platform publications only has one
  // status column, so this reflects whichever publish attempt touched it
  // most recently rather than a true aggregate across all of them.
  await moveVideo(claimedPublication.video_id, "PUBLISHING", actor).catch((err) =>
    console.error("Failed to move video to PUBLISHING", { video_id: claimedPublication.video_id, error: err })
  );

  try {
    const loadedAccount = await loadPlatformAccount(claimedPublication.account_id);
    if (!loadedAccount) throw new PublishInputError("account_not_found", "The account for this publication no longer exists.");
    if (!loadedAccount.canPublish) {
      throw new PublishInputError(
        "account_not_publish_authorized",
        "This account does not currently hold publish permission — reconnect it with the publish scope granted before trying again."
      );
    }
    if (loadedAccount.account.expires_at && new Date(loadedAccount.account.expires_at) <= new Date()) {
      throw new PublishInputError("token_expired", "This account's access token has expired — reconnect it from the Accounts page.");
    }

    const video = await getVideo(claimedPublication.video_id);
    if (!video) throw new PublishInputError("video_not_found", "The video for this publication no longer exists.");
    const videoUrl = await getSignedVideoUrlForPublish(video);
    if (!videoUrl) throw new PublishInputError("video_url_unavailable", "Could not generate a fetchable URL for the video file.");

    if (!claimedPublication.platform_content_id) {
      throw new PublishInputError("content_missing", "No generated content is attached to this publication.");
    }
    const { data: contentRow, error: contentError } = await supabaseAdmin
      .from("social_platform_content")
      .select("title, caption, hashtags, extra")
      .eq("id", claimedPublication.platform_content_id)
      .maybeSingle();
    if (contentError) throw new Error(contentError.message);
    if (!contentRow) throw new PublishInputError("content_missing", "The generated content for this publication no longer exists.");

    const content: PublishContent = {
      title: contentRow.title ?? "",
      caption: contentRow.caption ?? "",
      hashtags: contentRow.hashtags ?? [],
      extra: contentRow.extra ?? {},
    };

    const outcome = await adapter.publishVideo(loadedAccount.account, videoUrl, content);

    if (outcome.success === true) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("social_publications")
        .update({
          status: "PUBLISHED",
          published_at: new Date().toISOString(),
          platform_post_id: outcome.platformPostId,
          permalink: outcome.permalink,
          platform_response: outcome.platformResponse,
          error_code: null,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select(PUBLICATION_COLUMNS)
        .single();
      if (updateError) throw new Error(updateError.message);

      await moveVideo(claimedPublication.video_id, "PUBLISHED", actor).catch((err) =>
        console.error("Failed to move video to PUBLISHED after a successful publish", { video_id: claimedPublication.video_id, error: err })
      );

      const publishedRecord = updated as PublicationRecord;
      if (publishedRecord.published_at) {
        await createInitialMetricsRow(id, publishedRecord.platform, publishedRecord.published_at).catch((err) =>
          console.error("Failed to schedule initial metrics sync", { publication_id: id, error: err })
        );
      }

      await logAuditEvent({
        tableName: "social_publications",
        recordId: id,
        action: "publication_published",
        userId: actorUserId(actor),
        source: actor.source,
        mcpToolName: actorMcpToolName(actor),
        newValues: { platform_post_id: outcome.platformPostId, permalink: outcome.permalink },
      });

      return { publication: updated as PublicationRecord, outcome: "published" };
    }

    const failed = await markFailed(id, {
      errorCode: outcome.errorCode,
      errorMessage: outcome.errorMessage,
      platformResponse: outcome.platformResponse,
      incrementRetry: true,
    });
    await moveVideo(claimedPublication.video_id, "FAILED", actor).catch((err) =>
      console.error("Failed to move video to FAILED after a failed publish", { video_id: claimedPublication.video_id, error: err })
    );
    await logAuditEvent({
      tableName: "social_publications",
      recordId: id,
      action: "publication_failed",
      userId: actorUserId(actor),
      source: actor.source,
      mcpToolName: actorMcpToolName(actor),
      newValues: { error_code: outcome.errorCode, error_message: outcome.errorMessage, retryable: outcome.retryable },
    });
    return { publication: failed, outcome: "failed", errorMessage: outcome.errorMessage };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while publishing";
    const code = err instanceof PublishInputError ? err.code : "publish_exception";
    const failed = await markFailed(id, { errorCode: code, errorMessage: message, incrementRetry: true });
    await moveVideo(claimedPublication.video_id, "FAILED", actor).catch((moveErr) =>
      console.error("Failed to move video to FAILED after a publish exception", { video_id: claimedPublication.video_id, error: moveErr })
    );
    await logAuditEvent({
      tableName: "social_publications",
      recordId: id,
      action: "publication_failed",
      userId: actorUserId(actor),
      source: actor.source,
      mcpToolName: actorMcpToolName(actor),
      newValues: { error_code: code, error_message: message },
    });
    return { publication: failed, outcome: "failed", errorMessage: message };
  }
}
