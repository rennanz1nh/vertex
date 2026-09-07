import { describe, it, expect } from "vitest";
import { computeEngagement, nextStageAfter } from "../metrics-service";
import type { PostMetricsResult } from "../platforms/types";

const EMPTY: PostMetricsResult = { views: null, likes: null, comments: null, shares: null, saves: null, reach: null, watchTimeSeconds: null };

describe("computeEngagement", () => {
  it("returns null when every interaction count is null (never fabricates a number the platform didn't give)", () => {
    expect(computeEngagement(EMPTY)).toBeNull();
  });

  it("sums whatever interaction counts are present, treating a null as 0 in the sum", () => {
    expect(computeEngagement({ ...EMPTY, likes: 10, comments: 2, shares: null, saves: 1 })).toBe(13);
  });

  it("does not include views/reach/watchTime in the sum", () => {
    expect(computeEngagement({ ...EMPTY, likes: 5, views: 10_000, reach: 8_000 })).toBe(5);
  });
});

describe("nextStageAfter", () => {
  const publishedAt = new Date("2026-01-01T00:00:00Z").getTime();

  it("moves from 'initial' to the first checkpoint (10m after publish)", () => {
    const { stage, nextSyncAt } = nextStageAfter("initial", publishedAt, new Date("2026-01-01T00:05:00Z"));
    expect(stage).toBe("10m");
    expect(nextSyncAt).toBe(new Date(publishedAt + 10 * 60_000).toISOString());
  });

  it("advances sequentially through the defined checkpoints", () => {
    expect(nextStageAfter("10m", publishedAt, new Date()).stage).toBe("1h");
    expect(nextStageAfter("1h", publishedAt, new Date()).stage).toBe("6h");
    expect(nextStageAfter("6h", publishedAt, new Date()).stage).toBe("24h");
    expect(nextStageAfter("24h", publishedAt, new Date()).stage).toBe("48h");
    expect(nextStageAfter("48h", publishedAt, new Date()).stage).toBe("7d");
  });

  it("checkpoints are measured from published_at, not from 'now' — a late-running cron doesn't push them back", () => {
    const { nextSyncAt } = nextStageAfter("1h", publishedAt, new Date("2026-03-01T00:00:00Z"));
    expect(nextSyncAt).toBe(new Date(publishedAt + 6 * 60 * 60_000).toISOString());
  });

  it("falls into 'weekly' after the last defined checkpoint, measured from now (not from publish)", () => {
    const now = new Date("2026-02-01T00:00:00Z");
    const { stage, nextSyncAt } = nextStageAfter("7d", publishedAt, now);
    expect(stage).toBe("weekly");
    expect(nextSyncAt).toBe(new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString());
  });

  it("stays 'weekly' once already there", () => {
    const now = new Date("2026-03-01T00:00:00Z");
    expect(nextStageAfter("weekly", publishedAt, now).stage).toBe("weekly");
  });
});
