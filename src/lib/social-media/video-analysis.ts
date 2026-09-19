import { anthropic } from "@/lib/anthropic-client";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAuditEvent } from "@/lib/audit-log";
import { getVideo, getSignedThumbnailUrl, moveVideo } from "./video-service";
import { VideoAnalysisSchema, type VideoAnalysis } from "./content-schemas";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ActionActor } from "./types";

const ANALYSIS_SYSTEM_PROMPT = `You analyze short-form video content for a car rental company's social media team. You're given one representative frame from the video (its thumbnail) plus its filename — not the full video, so base your analysis on what's visible in the frame and reasonable inference from the filename, and keep claims about motion/audio out of scope. Be concrete and specific rather than generic; avoid restating the same idea across fields.`;

export interface AnalyzeVideoResult {
  analysisId: string;
  analysis: VideoAnalysis;
}

/**
 * Analyzes a video's thumbnail with Claude vision and stores the result.
 * Shared by the MCP analyze_video tool and (once Phase 13 lands) the
 * automated watch-folder pipeline — both call this, neither re-implements it.
 */
export async function analyzeVideo(videoId: string, actor: ActionActor): Promise<AnalyzeVideoResult> {
  const video = await getVideo(videoId);
  if (!video) throw new Error("Video not found");
  if (!video.thumbnail_path) {
    throw new Error("Video has no thumbnail yet — analysis needs at least one representative frame");
  }

  const thumbnailUrl = await getSignedThumbnailUrl(video);
  if (!thumbnailUrl) throw new Error("Could not generate a signed URL for the thumbnail");

  await supabaseAdmin.from("social_videos").update({ status: "ANALYZING", updated_at: new Date().toISOString() }).eq("id", videoId);

  const response = await anthropic.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8192,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: thumbnailUrl } },
          {
            type: "text",
            text: `Filename: ${video.filename}\nDuration: ${video.duration_seconds ?? "unknown"} seconds\n\nAnalyze this video for social media planning.`,
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(VideoAnalysisSchema), effort: "medium" },
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    await moveVideo(videoId, "FAILED", actor);
    throw new Error("Analysis did not complete (model declined or output did not match the expected shape)");
  }

  const analysis = response.parsed_output;

  const { data: inserted, error } = await supabaseAdmin
    .from("social_video_analysis")
    .insert({
      video_id: videoId,
      subject: analysis.subject,
      people: analysis.people,
      objects: analysis.objects,
      setting: analysis.setting,
      context: analysis.context,
      style: analysis.style,
      target_audience: analysis.target_audience,
      sentiment: analysis.sentiment,
      theme: analysis.theme,
      engagement_potential: analysis.engagement_potential,
      suggested_titles: analysis.suggested_titles,
      keywords: analysis.keywords,
      hashtag_suggestions: analysis.hashtag_suggestions,
      model: "claude-opus-5",
      raw_model_output: analysis,
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(error?.message ?? "Failed to store analysis");

  await moveVideo(videoId, "READY_FOR_REVIEW", actor);

  await logAuditEvent({
    tableName: "social_video_analysis",
    recordId: inserted.id,
    action: "video_analyzed",
    userId: actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
    newValues: { video_id: videoId },
  });

  return { analysisId: inserted.id, analysis };
}

export interface StoredVideoAnalysis extends VideoAnalysis {
  id: string;
  video_id: string;
  created_at: string;
}

export async function getLatestAnalysis(videoId: string): Promise<StoredVideoAnalysis | null> {
  const { data, error } = await supabaseAdmin
    .from("social_video_analysis")
    .select(
      "id, video_id, subject, people, objects, setting, context, style, target_audience, sentiment, theme, engagement_potential, suggested_titles, keywords, hashtag_suggestions, created_at"
    )
    .eq("video_id", videoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as StoredVideoAnalysis | null;
}
