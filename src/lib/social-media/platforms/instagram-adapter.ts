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
 * Instagram Graph API — Content Publishing (Reels).
 *
 * IMPORTANT — verification status: this environment's network egress
 * blocks developers.facebook.com (confirmed with a direct curl — a 403 on
 * the CONNECT tunnel itself, not a tool-level restriction), so none of this
 * could be checked against the live docs from this session. The base URL,
 * auth style, and endpoint shapes match what this repo's own existing
 * read-only Instagram code already uses successfully (src/lib/
 * social-insights.ts — same graph.facebook.com/v19.0 host, same
 * access_token query-param auth), which is real signal, but the specific
 * publishing endpoints below (media / media_publish / comments) are from
 * training knowledge only. Confirm against
 * https://developers.facebook.com/docs/instagram-platform/content-publishing
 * before the first live publish attempt.
 */

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const CONTAINER_POLL_INTERVAL_MS = 3000;
const CONTAINER_POLL_MAX_ATTEMPTS = 20; // ~60s total, generous for short-form video

export function buildCaption(content: PublishContent): string {
  const hashtagLine = content.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  return hashtagLine ? `${content.caption}\n\n${hashtagLine}` : content.caption;
}

async function graphFetch(path: string, accessToken: string, params: Record<string, string>, method: "GET" | "POST" = "GET") {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const searchParams = method === "GET" ? url.searchParams : new URLSearchParams();
  for (const [key, value] of Object.entries(params)) searchParams.set(key, value);
  searchParams.set("access_token", accessToken);

  if (method === "GET") {
    url.search = searchParams.toString();
    const response = await fetch(url.toString());
    return { ok: response.ok, status: response.status, data: await response.json().catch(() => null) };
  }

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: searchParams.toString(),
  });
  return { ok: response.ok, status: response.status, data: await response.json().catch(() => null) };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const instagramAdapter: SocialPlatformAdapter = {
  platform: "instagram",

  async publishVideo(account: PlatformAccount, videoUrl: string, content: PublishContent): Promise<PublishOutcome> {
    if (!account.account_id) {
      return { success: false, errorCode: "missing_account_id", errorMessage: "No Instagram user ID on this account", retryable: false, platformResponse: null };
    }

    // Step 1: create a media container (Reels).
    const container = await graphFetch(
      `/${account.account_id}/media`,
      account.access_token,
      { media_type: "REELS", video_url: videoUrl, caption: buildCaption(content) },
      "POST"
    );
    if (!container.ok || !container.data?.id) {
      return {
        success: false,
        errorCode: container.data?.error?.code?.toString() ?? "container_creation_failed",
        errorMessage: container.data?.error?.message ?? "Failed to create Instagram media container",
        retryable: container.status >= 500,
        platformResponse: container.data,
      };
    }
    const creationId: string = container.data.id;

    // Step 2: poll until Instagram finishes processing the video.
    let finished = false;
    let lastStatus: unknown = null;
    for (let attempt = 0; attempt < CONTAINER_POLL_MAX_ATTEMPTS; attempt++) {
      await sleep(CONTAINER_POLL_INTERVAL_MS);
      const status = await graphFetch(`/${creationId}`, account.access_token, { fields: "status_code,status" });
      lastStatus = status.data;
      const statusCode = status.data?.status_code;
      if (statusCode === "FINISHED") {
        finished = true;
        break;
      }
      if (statusCode === "ERROR" || statusCode === "EXPIRED") {
        return {
          success: false,
          errorCode: `container_${statusCode.toLowerCase()}`,
          errorMessage: status.data?.status ?? "Instagram failed to process the video",
          retryable: false,
          platformResponse: status.data,
        };
      }
    }
    if (!finished) {
      return {
        success: false,
        errorCode: "container_processing_timeout",
        errorMessage: "Instagram is still processing the video after 60s — retry later; this call did not publish anything yet",
        retryable: true,
        platformResponse: lastStatus,
      };
    }

    // Step 3: publish the finished container.
    const published = await graphFetch(`/${account.account_id}/media_publish`, account.access_token, { creation_id: creationId }, "POST");
    if (!published.ok || !published.data?.id) {
      return {
        success: false,
        errorCode: published.data?.error?.code?.toString() ?? "publish_failed",
        errorMessage: published.data?.error?.message ?? "Failed to publish the Instagram container",
        retryable: published.status >= 500,
        platformResponse: published.data,
      };
    }
    const mediaId: string = published.data.id;

    const permalinkResponse = await graphFetch(`/${mediaId}`, account.access_token, { fields: "permalink" });
    const permalink: string | null = permalinkResponse.data?.permalink ?? null;

    const firstComment = typeof content.extra.first_comment === "string" ? content.extra.first_comment : null;
    if (firstComment) {
      // Best-effort: a failed first comment shouldn't fail an otherwise-successful publish.
      await graphFetch(`/${mediaId}/comments`, account.access_token, { message: firstComment }, "POST").catch(() => null);
    }

    return { success: true, platformPostId: mediaId, permalink, platformResponse: published.data };
  },

  async getPublishStatus(account: PlatformAccount, platformPostId: string): Promise<PublishStatusResult> {
    const response = await graphFetch(`/${platformPostId}`, account.access_token, { fields: "permalink" });
    if (!response.ok) {
      return { status: "failed", permalink: null, errorMessage: response.data?.error?.message ?? "Could not fetch post status" };
    }
    return { status: "published", permalink: response.data?.permalink ?? null, errorMessage: null };
  },

  async getMetrics(account: PlatformAccount, platformPostId: string): Promise<PostMetricsResult> {
    const empty: PostMetricsResult = { views: null, likes: null, comments: null, shares: null, saves: null, reach: null, watchTimeSeconds: null };
    const response = await graphFetch(`/${platformPostId}/insights`, account.access_token, {
      metric: "reach,likes,comments,shares,saved,plays",
    });
    if (!response.ok || !Array.isArray(response.data?.data)) return empty;

    const byName = new Map<string, number>();
    for (const entry of response.data.data) {
      const value = entry?.values?.[0]?.value;
      if (typeof value === "number") byName.set(entry.name, value);
    }
    return {
      views: byName.get("plays") ?? null,
      likes: byName.get("likes") ?? null,
      comments: byName.get("comments") ?? null,
      shares: byName.get("shares") ?? null,
      saves: byName.get("saved") ?? null,
      reach: byName.get("reach") ?? null,
      watchTimeSeconds: null,
    };
  },

  async getAccountInfo(account: PlatformAccount): Promise<AccountInfoResult> {
    if (!account.account_id) return { accountId: "", accountName: null, avatarUrl: null, followerCount: null };
    const response = await graphFetch(`/${account.account_id}`, account.access_token, {
      fields: "username,profile_picture_url,followers_count",
    });
    return {
      accountId: account.account_id,
      accountName: response.data?.username ?? null,
      avatarUrl: response.data?.profile_picture_url ?? null,
      followerCount: response.data?.followers_count ?? null,
    };
  },
};
