import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { tiktokAdapter, getTikTokCreatorInfo } from "../tiktok-adapter";
import type { PlatformAccount, PublishContent } from "../types";

const account: PlatformAccount = {
  id: "acc-1",
  platform: "tiktok",
  account_id: "tt-user-1",
  access_token: "token-123",
  refresh_token: null,
  expires_at: null,
};

const content: PublishContent = {
  title: "Morning glow",
  caption: "Starting the day right",
  hashtags: ["skincare", "fyp"],
  extra: { suggested_privacy: "public", allow_comments: true, allow_duet: false, allow_stitch: false },
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body };
}

function creatorInfoResponse(privacyLevelOptions: string[]) {
  return jsonResponse({
    data: {
      creator_nickname: "Test Creator",
      creator_avatar_url: "https://example.com/avatar.jpg",
      privacy_level_options: privacyLevelOptions,
      max_video_post_duration_sec: 180,
      comment_disabled: false,
      duet_disabled: false,
      stitch_disabled: false,
    },
  });
}

describe("getTikTokCreatorInfo", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("returns null (not a thrown error) when the endpoint fails, so callers can decide how to handle it", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "invalid token" } }, false));
    expect(await getTikTokCreatorInfo(account)).toBeNull();
  });

  it("maps the response fields correctly", async () => {
    fetchMock.mockResolvedValueOnce(creatorInfoResponse(["SELF_ONLY"]));
    const info = await getTikTokCreatorInfo(account);
    expect(info).toEqual({
      nickname: "Test Creator",
      avatarUrl: "https://example.com/avatar.jpg",
      privacyLevelOptions: ["SELF_ONLY"],
      maxVideoDurationSeconds: 180,
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
    });
  });
});

describe("tiktokAdapter.publishVideo — privacy-level gating (spec: never work around the unaudited-app restriction)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("refuses to publish when the requested privacy level isn't in this account/app's allowed options", async () => {
    // A typical unaudited app: TikTok only allows SELF_ONLY, but the requested content asks for "public".
    fetchMock.mockResolvedValueOnce(creatorInfoResponse(["SELF_ONLY"]));

    const result = await tiktokAdapter.publishVideo(account, "https://example.com/video.mp4", content);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.errorCode).toBe("privacy_level_not_available");
      expect(result.retryable).toBe(false);
      // Must name what IS actually available, not just say "no".
      expect(result.errorMessage).toContain("SELF_ONLY");
    }
    // creator_info was queried, but /post/publish/video/init/ must never have been called.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT silently downgrade to an available privacy level — it fails loudly instead", async () => {
    fetchMock.mockResolvedValueOnce(creatorInfoResponse(["SELF_ONLY"]));
    const result = await tiktokAdapter.publishVideo(account, "https://example.com/video.mp4", content);
    // If this ever starts returning success:true, the adapter silently switched the privacy
    // level behind the caller's back — exactly what spec section 10/42 forbids.
    expect(result.success).toBe(false);
  });

  it("proceeds to init+poll when the requested privacy level IS available", async () => {
    fetchMock
      .mockResolvedValueOnce(creatorInfoResponse(["PUBLIC_TO_EVERYONE", "SELF_ONLY"]))
      .mockResolvedValueOnce(jsonResponse({ data: { publish_id: "pub-1" } })) // init
      .mockResolvedValueOnce(jsonResponse({ data: { status: "PUBLISH_COMPLETE", publicly_available_post_id: ["12345"] } })); // status poll

    const resultPromise = tiktokAdapter.publishVideo(account, "https://example.com/video.mp4", content);
    await vi.advanceTimersByTimeAsync(3000);
    const result = await resultPromise;

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.platformPostId).toBe("pub-1");
      expect(result.permalink).toContain("12345");
    }
  });

  it("fails with a clear reason when creator_info can't be fetched at all, before ever attempting init", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: "down" } }, false));
    const result = await tiktokAdapter.publishVideo(account, "https://example.com/video.mp4", content);
    expect(result.success).toBe(false);
    if (result.success === false) expect(result.errorCode).toBe("creator_info_unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
