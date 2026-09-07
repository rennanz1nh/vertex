import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { processVideoPipeline } from "@/lib/social-media/pipeline-service";
import { toolResult, toolError, getAuth, hasWriteScope } from "./helpers";

/**
 * process_video: the single high-level tool the spec asks for so Claude
 * doesn't have to manually chain analyze_video -> generate_platform_content
 * -> create_publication for routine cases. Internally it's the same
 * pipeline the Phase 13 inbox watcher cron runs on autopilot — this is
 * that same logic, callable on demand for a video that's already in the
 * library (manually uploaded, or one the watcher only partly finished).
 */
export function registerPipelineTools(server: McpServer) {
  server.registerTool(
    "process_video",
    {
      title: "Process video",
      description:
        "Run the full pipeline on an existing video: analyze it (if not already analyzed), generate per-platform content for Instagram/TikTok, and create a publication for each platform that has a default account configured in automation settings. Every publication starts PENDING_APPROVAL; it only moves further on its own for an account that's explicitly opted into AUTO publish mode (auto_publish_enabled + that account's auto_publish_authorized) — check created_publication_ids with get_publication_status if you need to know whether that happened. Respects the other automation toggles too (auto_analysis, auto_generate_captions/hashtags). Safe to call more than once on the same video; it skips work that's already done. Requires write access.",
      inputSchema: z.object({ video_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ video_id }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const result = await processVideoPipeline(video_id, { source: "mcp_tool", userId, mcpToolName: "process_video" });
        return toolResult({
          success: true,
          video: result.video,
          analyzed: result.analyzed,
          generated_platforms: result.generatedPlatforms,
          created_publication_ids: result.createdPublicationIds,
          skipped_reasons: result.skippedReasons,
        });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to process video");
      }
    }
  );
}
