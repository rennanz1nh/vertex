import { z } from "zod";

export const VideoAnalysisSchema = z.object({
  subject: z.string().describe("What the video is about, one sentence"),
  people: z.array(z.string()).describe("People visible, described generically (e.g. 'one adult woman')"),
  objects: z.array(z.string()).describe("Notable objects/products visible"),
  setting: z.string().describe("Where this appears to take place"),
  context: z.string().describe("Broader context/occasion suggested by the video"),
  style: z.string().describe("Visual/editing style, e.g. 'bright, close-up, tutorial-style'"),
  target_audience: z.string(),
  sentiment: z.string().describe("Overall mood/tone, e.g. 'upbeat', 'calm', 'aspirational'"),
  theme: z.string(),
  engagement_potential: z.string().describe("Brief assessment of what could drive engagement, and why"),
  suggested_titles: z.array(z.string()).min(2).max(5),
  keywords: z.array(z.string()).min(3).max(15),
  hashtag_suggestions: z.array(z.string()).min(3).max(15).describe("Platform-agnostic base hashtag ideas, without the # symbol"),
});
export type VideoAnalysis = z.infer<typeof VideoAnalysisSchema>;

export const InstagramContentSchema = z.object({
  title: z.string(),
  caption: z.string().describe("Instagram caption, can include line breaks and emoji"),
  hashtags: z.array(z.string()).min(5).max(30).describe("Without the # symbol"),
  first_comment: z.string().nullable().describe("Optional extra hashtags/CTA to post as the first comment instead of in the caption, or null"),
  suggested_location: z.string().nullable(),
  mentions: z.array(z.string()).describe("Suggested @handles to mention, without the @ symbol — usually empty unless the video clearly features a brand/person"),
});
export type InstagramContent = z.infer<typeof InstagramContentSchema>;

export const TikTokContentSchema = z.object({
  title: z.string(),
  caption: z.string().describe("TikTok caption — shorter and punchier than Instagram's"),
  hashtags: z.array(z.string()).min(3).max(10).describe("Without the # symbol — TikTok favors fewer, more targeted hashtags than Instagram"),
  suggested_privacy: z.enum(["public", "friends", "private"]),
  allow_comments: z.boolean(),
  allow_duet: z.boolean(),
  allow_stitch: z.boolean(),
});
export type TikTokContent = z.infer<typeof TikTokContentSchema>;
