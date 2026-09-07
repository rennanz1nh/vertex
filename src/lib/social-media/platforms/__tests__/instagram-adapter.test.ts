import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { instagramAdapter, buildCaption } from "../instagram-adapter";
import type { PlatformAccount, PublishContent } from "../types";

const account: PlatformAccount = {
  id: "acc-1",
  platform: "instagram",
  account_id: "ig-user-1",
  access_token: "token-123",
  refresh_token: null,
  expires_at: null,
};

const content: PublishContent = {
  title: "Morning glow",
  caption: "Starting the day right",
  hashtags: ["skincare", "#glow"],
  extra: {},
};

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body };
}

describe("buildCaption", () => {
  it("appends hashtags (each normalized to a leading #) after the caption", () => {
    expect(buildCaption(content)).toBe("Starting the day right\n\n#skincare #glow");
  });

  it("returns just the caption when there are no hashtags", () => {
    expect(buildCaption({ ...content, hashtags: [] })).toBe("Starting the day right");
  });
});

describe("instagramAdapter.publishVideo", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // The adapter really does `await sleep(3000)` between each poll — fake timers let the
    // test advance past that instantly instead of the suite actually taking several seconds.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("fails immediately (no network call) when the account has no account_id", async () => {
    const result = await instagramAdapter.publishVideo({ ...account, account_id: null }, "https://example.com/video.mp4", content);
    expect(result.success).toBe(false);
    if (result.success === false) expect(result.errorCode).toBe("missing_account_id");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("runs container -> poll -> publish and returns the permalink on success", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "creation-1" })) // create container
      .mockResolvedValueOnce(jsonResponse({ status_code: "FINISHED" })) // poll
      .mockResolvedValueOnce(jsonResponse({ id: "media-1" })) // publish
      .mockResolvedValueOnce(jsonResponse({ permalink: "https://instagram.com/p/media-1" })); // permalink lookup

    const resultPromise = instagramAdapter.publishVideo(account, "https://example.com/video.mp4", content);
    await vi.advanceTimersByTimeAsync(3000);
    const result = await resultPromise;

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.platformPostId).toBe("media-1");
      expect(result.permalink).toBe("https://instagram.com/p/media-1");
    }
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails without publishing when the container processing errors out", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: "creation-1" }))
      .mockResolvedValueOnce(jsonResponse({ status_code: "ERROR", status: "Video format not supported" }));

    const resultPromise = instagramAdapter.publishVideo(account, "https://example.com/video.mp4", content);
    await vi.advanceTimersByTimeAsync(3000);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.errorCode).toBe("container_error");
      expect(result.retryable).toBe(false);
    }
    // Only the create + one poll call — media_publish must never fire after a container error.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces the platform's error message when container creation itself fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: 190, message: "Invalid OAuth access token" } }, false));

    const result = await instagramAdapter.publishVideo(account, "https://example.com/video.mp4", content);

    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.errorMessage).toBe("Invalid OAuth access token");
      expect(result.retryable).toBe(false); // 400-level, not a 5xx
    }
  });
});
