import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { analyzeVideo, getLatestAnalysis } from "@/lib/social-media/video-analysis";
import { generatePlatformContent, getPlatformContent } from "@/lib/social-media/content-generation";
import { SOCIAL_PLATFORMS } from "@/lib/social-media/types";
import { toolResult, toolError, getAuth, hasWriteScope } from "./helpers";

const GENERATABLE_PLATFORMS = ["instagram", "tiktok"] as const;

/**
 * AI CONTENT TOOLS (spec section 11). These call the Anthropic API and write
 * to the database (a fresh analysis or content row), so — like the write
 * video tools — they require mcp:write, not just mcp:read: generating
 * content isn't free or side-effect-free the way a lookup is.
 * analyze_content_performance lives in metrics-tools.ts instead, once
 * Phase 12 gave it real metrics data to read.
 */
export function registerContentTools(server: McpServer) {
  server.registerTool(
    "analyze_video",
    {
      title: "Analyze video",
      description: "Run Claude vision analysis on a video's thumbnail (subject, audience, sentiment, suggested titles/keywords/hashtags). Requires write access.",
      inputSchema: z.object({ video_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ video_id }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const result = await analyzeVideo(video_id, { source: "mcp_tool", userId, mcpToolName: "analyze_video" });
        return toolResult({ success: true, analysis_id: result.analysisId, analysis: result.analysis });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Analysis failed");
      }
    }
  );

  server.registerTool(
    "generate_platform_content",
    {
      title: "Generate platform content",
      description: "Generate and store title/caption/hashtags for a video, tailored per platform (Instagram and TikTok have different voices and hashtag strategies). Requires an existing analysis (run analyze_video first). Requires write access.",
      inputSchema: z.object({
        video_id: z.string().uuid(),
        platforms: z.array(z.enum(GENERATABLE_PLATFORMS)).min(1),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ video_id, platforms }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const content = await generatePlatformContent(video_id, platforms, { source: "mcp_tool", userId, mcpToolName: "generate_platform_content" });
        return toolResult({ success: true, content });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Content generation failed");
      }
    }
  );

  const singleFieldTool = (
    name: "generate_title" | "generate_caption" | "generate_hashtags",
    field: "title" | "caption" | "hashtags",
    title: string,
    description: string
  ) => {
    server.registerTool(
      name,
      {
        title,
        description,
        inputSchema: z.object({ video_id: z.string().uuid(), platform: z.enum(GENERATABLE_PLATFORMS) }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async ({ video_id, platform }, ctx: ServerContext) => {
        if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
        const { userId } = getAuth(ctx);
        try {
          // Caption/hashtags/title are generated together in one call (they're context-coupled —
          // a hashtag set picked without the caption in view tends to be worse), then sliced here.
          const [content] = await generatePlatformContent(video_id, [platform], { source: "mcp_tool", userId, mcpToolName: name });
          return toolResult({ success: true, platform, [field]: content[field] });
        } catch (error) {
          return toolError(error instanceof Error ? error.message : "Generation failed");
        }
      }
    );
  };

  singleFieldTool("generate_title", "title", "Generate title", "Generate (and store) just the title for a video on one platform.");
  singleFieldTool("generate_caption", "caption", "Generate caption", "Generate (and store) just the caption for a video on one platform.");
  singleFieldTool("generate_hashtags", "hashtags", "Generate hashtags", "Generate (and store) just the hashtags for a video on one platform.");

  server.registerTool(
    "get_video_analysis",
    {
      title: "Get video analysis",
      description: "Get the stored analysis for a video, if one has been run.",
      inputSchema: z.object({ video_id: z.string().uuid() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ video_id }) => {
      const analysis = await getLatestAnalysis(video_id);
      if (!analysis) return toolResult({ success: true, video_id, analysis: null });
      return toolResult({ success: true, video_id, analysis });
    }
  );

  server.registerTool(
    "get_platform_content",
    {
      title: "Get platform content",
      description: "Get the stored generated content (title/caption/hashtags) for a video on one platform, if any.",
      inputSchema: z.object({ video_id: z.string().uuid(), platform: z.enum(SOCIAL_PLATFORMS) }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ video_id, platform }) => {
      const content = await getPlatformContent(video_id, platform);
      return toolResult({ success: true, video_id, platform, content });
    }
  );
}
