import type {
  AccountInfoResult,
  PlatformAccount,
  PostMetricsResult,
  PublishContent,
  PublishOutcome,
  PublishStatusResult,
  SocialPlatformAdapter,
} from "./types";

/**
 * TikTok Content Posting API.
 *
 * IMPORTANT — verification status: this environment's network egress blocks
 * developers.tiktok.com (confirmed with a direct curl — a 403 on the
 * CONNECT tunnel itself), so this could not be checked against the live
 * docs from this session. The host (open.tiktokapis.com/v2) and auth style
 * match this repo's own existing read-only TikTok code (src/lib/
 * social-insights.ts, using the same host and Bearer-token auth), which is
 * real signal, but the specific publishing endpoints below are from
 * training knowledge only. Confirm against
 * https://developers.tiktok.com/doc/content-posting-api-get-started/
 * before the first live publish attempt.
 *
 * Unaudited apps are restricted by TikTok to SELF_ONLY (private) posts —
 * this adapter does not attempt to work around that (spec section 10/42):
 * it queries the creator's actually-available privacy options first and
 * surfaces a clear error if the requested one isn't allowed, rather than
 * silently downgrading or retrying with a different value.
 */

const API_BASE = "https://open.tiktokapis.com/v2";

const PRIVACY_MAP: Record<string, string> = {
  public: "PUBLIC_TO_EVERYONE",
  friends: "MUTUAL_FOLLOW_FRIENDS",
  private: "SELF_ONLY",
};

async function tiktokFetch(path: string, accessToken: string, body?: Record<string, unknown>) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

export interface TikTokCreatorInfo {
  nickname: string | null;
  avatarUrl: string | null;
  privacyLevelOptions: string[];
  maxVideoDurationSeconds: number | null;
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
}

/** spec section 11's get_tiktok_creator_info — must be called before publish so we only request a privacy_level TikTok will actually accept for this creator/app pairing. */
export async function getTikTokCreatorInfo(account: PlatformAccount): Promise<TikTokCreatorInfo | null> {
  const response = await tiktokFetch("/post/publish/creator_info/query/", account.access_token);
  if (!response.ok || !response.data?.data) return null;
  const d = response.data.data;
  return {
    nickname: d.creator_nickname ?? null,
    avatarUrl: d.creator_avatar_url ?? null,
    privacyLevelOptions: d.privacy_level_options ?? [],
    maxVideoDurationSeconds: typeof d.max_video_post_duration_sec === "number" ? d.max_video_post_duration_sec : null,
    commentDisabled: !!d.comment_disabled,
    duetDisabled: !!d.duet_disabled,
    stitchDisabled: !!d.stitch_disabled,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const tiktokAdapter: SocialPlatformAdapter = {
  platform: "tiktok",

  async publishVideo(account: PlatformAccount, videoUrl: string, content: PublishContent): Promise<PublishOutcome> {
    const creatorInfo = await getTikTokCreatorInfo(account);
    if (!creatorInfo) {
      return { success: false, errorCode: "creator_info_unavailable", errorMessage: "Could not fetch TikTok creator info before publishing", retryable: true, platformResponse: null };
    }

    const requestedPrivacy = typeof content.extra.suggested_privacy === "string" ? content.extra.suggested_privacy : "private";
    const mappedPrivacy = PRIVACY_MAP[requestedPrivacy] ?? "SELF_ONLY";
    if (!creatorInfo.privacyLevelOptions.includes(mappedPrivacy)) {
      return {
        success: false,
        errorCode: "privacy_level_not_available",
        errorMessage: `This TikTok account/app cannot post with privacy '${mappedPrivacy}'. Available: ${creatorInfo.privacyLevelOptions.join(", ") || "none — the app may not be audited for Direct Post yet"}.`,
        retryable: false,
        platformResponse: creatorInfo,
      };
    }

    const title = content.hashtags.length > 0 ? `${content.caption} ${content.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}` : content.caption;

    const init = await tiktokFetch("/post/publish/video/init/", account.access_token, {
      post_info: {
        title,
        privacy_level: mappedPrivacy,
        disable_comment: content.extra.allow_comments === false,
        disable_duet: content.extra.allow_duet === false,
        disable_stitch: content.extra.allow_stitch === false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: videoUrl,
      },
    });
    if (!init.ok || !init.data?.data?.publish_id) {
      return {
        success: false,
        errorCode: init.data?.error?.code ?? "init_failed",
        errorMessage: init.data?.error?.message ?? "Failed to initiate TikTok video post",
        retryable: init.status >= 500,
        platformResponse: init.data,
      };
    }
    const publishId: string = init.data.data.publish_id;

    // Poll for completion — TikTok pulls the video from our URL and processes it async.
    for (let attempt = 0; attempt < 20; attempt++) {
      await sleep(3000);
      const status = await this.getPublishStatus(account, publishId);
      if (status.status === "published") {
        return { success: true, platformPostId: publishId, permalink: status.permalink, platformResponse: init.data };
      }
      if (status.status === "failed") {
        return { success: false, errorCode: "publish_failed", errorMessage: status.errorMessage ?? "TikTok reported the post failed", retryable: false, platformResponse: init.data };
      }
    }
    return {
      success: false,
      errorCode: "publish_processing_timeout",
      errorMessage: "TikTok is still processing the video after 60s — check status later with publish_id " + publishId,
      retryable: true,
      platformResponse: { publish_id: publishId },
    };
  },

  async getPublishStatus(account: PlatformAccount, platformPostId: string): Promise<PublishStatusResult> {
    const response = await tiktokFetch("/post/publish/status/fetch/", account.access_token, { publish_id: platformPostId });
    if (!response.ok || !response.data?.data) {
      return { status: "failed", permalink: null, errorMessage: response.data?.error?.message ?? "Could not fetch publish status" };
    }
    const status: string = response.data.data.status;
    if (status === "PUBLISH_COMPLETE") {
      const publiclyAvailablePostId: string | undefined = response.data.data.publicaly_available_post_id?.[0] ?? response.data.data.publicly_available_post_id?.[0];
      return { status: "published", permalink: publiclyAvailablePostId ? `https://www.tiktok.com/@/video/${publiclyAvailablePostId}` : null, errorMessage: null };
    }
    if (status === "FAILED") {
      return { status: "failed", permalink: null, errorMessage: response.data.data.fail_reason ?? "Unknown failure" };
    }
    return { status: "processing", permalink: null, errorMessage: null };
  },

  async getMetrics(account: PlatformAccount, platformPostId: string): Promise<PostMetricsResult> {
    const empty: PostMetricsResult = { views: null, likes: null, comments: null, shares: null, saves: null, reach: null, watchTimeSeconds: null };
    const response = await fetch(`${API_BASE}/video/query/?fields=id,like_count,comment_count,share_count,view_count`, {
      method: "POST",
      headers: { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ filters: { video_ids: [platformPostId] } }),
    });
    const data = await response.json().catch(() => null);
    const video = data?.data?.videos?.[0];
    if (!video) return empty;
    return {
      views: video.view_count ?? null,
      likes: video.like_count ?? null,
      comments: video.comment_count ?? null,
      shares: video.share_count ?? null,
      saves: null,
      reach: null,
      watchTimeSeconds: null,
    };
  },

  async getAccountInfo(account: PlatformAccount): Promise<AccountInfoResult> {
    const info = await getTikTokCreatorInfo(account);
    return {
      accountId: account.account_id ?? "",
      accountName: info?.nickname ?? null,
      avatarUrl: info?.avatarUrl ?? null,
      followerCount: null,
    };
  },
};
