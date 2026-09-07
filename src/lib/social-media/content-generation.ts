import { anthropic } from "@/lib/anthropic-client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAuditEvent } from "@/lib/audit-log";
import { getVideo } from "./video-service";
import { getLatestAnalysis } from "./video-analysis";
import { InstagramContentSchema, TikTokContentSchema, type InstagramContent, type TikTokContent } from "./content-schemas";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ActionActor, SocialPlatform } from "./types";

const CONTENT_SYSTEM_PROMPT = `You write social media captions and hashtags for a cosmetics/beauty marketplace. Match each platform's real voice — Instagram captions can be longer and more descriptive; TikTok captions are short and punchy. Never reuse the exact same hashtag set across platforms unless a hashtag is genuinely a strong fit on both — each platform's audience and discovery algorithm differ. Do not invent product claims, prices, or availability that weren't given to you.`;

export type PlatformContent =
  | { platform: "instagram"; content: InstagramContent }
  | { platform: "tiktok"; content: TikTokContent };

async function generateForPlatform(platform: SocialPlatform, videoContext: string): Promise<PlatformContent> {
  if (platform === "instagram") {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `${videoContext}\n\nWrite Instagram content for this video (Reel).` }],
      output_config: { format: zodOutputFormat(InstagramContentSchema), effort: "medium" },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error("Instagram content generation did not complete");
    }
    return { platform: "instagram", content: response.parsed_output };
  }

  if (platform === "tiktok") {
    const response = await anthropic.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4096,
      system: CONTENT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `${videoContext}\n\nWrite TikTok content for this video.` }],
      output_config: { format: zodOutputFormat(TikTokContentSchema), effort: "medium" },
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error("TikTok content generation did not complete");
    }
    return { platform: "tiktok", content: response.parsed_output };
  }

  throw new Error(`Content generation for platform '${platform}' isn't implemented yet`);
}

export interface GeneratedPlatformContentRow {
  id: string;
  video_id: string;
  platform: SocialPlatform;
  title: string;
  caption: string;
  hashtags: string[];
  extra: Record<string, unknown>;
}

/** Generates and stores platform-specific content for one video across the given platforms. Requires an existing video analysis (spec section 8: content generation builds on the analysis, not the raw video). */
export async function generatePlatformContent(
  videoId: string,
  platforms: SocialPlatform[],
  actor: ActionActor
): Promise<GeneratedPlatformContentRow[]> {
  const video = await getVideo(videoId);
  if (!video) throw new Error("Video not found");

  const analysis = await getLatestAnalysis(videoId);
  if (!analysis) throw new Error("No analysis found for this video yet — run analyze_video first");

  const videoContext = [
    `Video subject: ${analysis.subject}`,
    `Setting: ${analysis.setting}`,
    `Style: ${analysis.style}`,
    `Target audience: ${analysis.target_audience}`,
    `Sentiment: ${analysis.sentiment}`,
    `Theme: ${analysis.theme}`,
    `Suggested titles: ${analysis.suggested_titles.join(", ")}`,
    `Keywords: ${analysis.keywords.join(", ")}`,
  ].join("\n");

  const results: GeneratedPlatformContentRow[] = [];

  for (const platform of platforms) {
    const generated = await generateForPlatform(platform, videoContext);
    const { title, caption, hashtags, ...extra } = generated.content;

    const { data: row, error } = await supabaseAdmin
      .from("social_platform_content")
      .upsert(
        {
          video_id: videoId,
          platform,
          title,
          caption,
          hashtags,
          extra,
          generated_by: "ai",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "video_id,platform" }
      )
      .select("id, video_id, platform, title, caption, hashtags, extra")
      .single();
    if (error || !row) throw new Error(error?.message ?? `Failed to store ${platform} content`);

    results.push(row as GeneratedPlatformContentRow);
  }

  await logAuditEvent({
    tableName: "social_platform_content",
    recordId: videoId,
    action: "platform_content_generated",
    userId: actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
    newValues: { platforms },
  });

  return results;
}

export async function getPlatformContent(videoId: string, platform: SocialPlatform): Promise<GeneratedPlatformContentRow | null> {
  const { data, error } = await supabaseAdmin
    .from("social_platform_content")
    .select("id, video_id, platform, title, caption, hashtags, extra")
    .eq("video_id", videoId)
    .eq("platform", platform)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as GeneratedPlatformContentRow | null;
}
