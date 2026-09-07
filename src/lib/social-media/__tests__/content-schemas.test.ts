import { describe, it, expect } from "vitest";
import { VideoAnalysisSchema, InstagramContentSchema, TikTokContentSchema } from "../content-schemas";

const validAnalysis = {
  subject: "A skincare routine demo",
  people: ["one adult woman"],
  objects: ["serum bottle"],
  setting: "bathroom",
  context: "morning routine",
  style: "bright, close-up",
  target_audience: "women 25-40",
  sentiment: "calm",
  theme: "self-care",
  engagement_potential: "relatable routine content",
  suggested_titles: ["My morning routine", "5 steps to glowing skin"],
  keywords: ["skincare", "serum", "routine"],
  hashtag_suggestions: ["skincare", "selfcare", "morningroutine"],
};

describe("VideoAnalysisSchema", () => {
  it("accepts a well-formed analysis", () => {
    expect(VideoAnalysisSchema.safeParse(validAnalysis).success).toBe(true);
  });

  it("rejects fewer than 2 suggested titles", () => {
    const result = VideoAnalysisSchema.safeParse({ ...validAnalysis, suggested_titles: ["Only one"] });
    expect(result.success).toBe(false);
  });

  it("rejects fewer than 3 keywords", () => {
    const result = VideoAnalysisSchema.safeParse({ ...validAnalysis, keywords: ["one", "two"] });
    expect(result.success).toBe(false);
  });
});

describe("InstagramContentSchema", () => {
  const base = {
    title: "Morning glow routine",
    caption: "Starting the day right ✨",
    hashtags: ["skincare", "selfcare", "beauty", "glow", "morningroutine"],
    first_comment: null,
    suggested_location: null,
    mentions: [],
  };

  it("accepts a well-formed Instagram content object", () => {
    expect(InstagramContentSchema.safeParse(base).success).toBe(true);
  });

  it("rejects fewer than 5 hashtags", () => {
    const result = InstagramContentSchema.safeParse({ ...base, hashtags: ["a", "b"] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 30 hashtags", () => {
    const tooMany = Array.from({ length: 31 }, (_, i) => `tag${i}`);
    const result = InstagramContentSchema.safeParse({ ...base, hashtags: tooMany });
    expect(result.success).toBe(false);
  });
});

describe("TikTokContentSchema", () => {
  const base = {
    title: "Morning glow routine",
    caption: "5 min routine 💧",
    hashtags: ["skincare", "beauty", "fyp"],
    suggested_privacy: "public",
    allow_comments: true,
    allow_duet: true,
    allow_stitch: false,
  };

  it("accepts a well-formed TikTok content object", () => {
    expect(TikTokContentSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an invalid suggested_privacy value", () => {
    const result = TikTokContentSchema.safeParse({ ...base, suggested_privacy: "everyone" });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 hashtags (TikTok favors fewer than Instagram)", () => {
    const tooMany = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    const result = TikTokContentSchema.safeParse({ ...base, hashtags: tooMany });
    expect(result.success).toBe(false);
  });
});
