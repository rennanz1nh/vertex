import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { deleteVideo, getVideo, listVideos, moveVideo } from "@/lib/social-media/video-service";
import { VIDEO_STATUSES } from "@/lib/social-media/types";
import { toolResult, toolError, getAuth, hasWriteScope } from "./helpers";

/** Video-library tools (spec section 11: VIDEO TOOLS). analyze_video lands with Phase 6. */
export function registerVideoTools(server: McpServer) {
  server.registerTool(
    "list_videos",
    {
      title: "List videos",
      description: "List videos in the Social Media Hub video library, optionally filtered by status.",
      inputSchema: z.object({
        status: z.enum(VIDEO_STATUSES).optional().describe("Filter to a single status"),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ status, limit }) => {
      try {
        const videos = await listVideos({ status, limit });
        return toolResult({ success: true, videos });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to list videos");
      }
    }
  );

  server.registerTool(
    "get_video",
    {
      title: "Get video",
      description: "Get full details for one video by id.",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ id }) => {
      const video = await getVideo(id);
      if (!video) return toolError("Video not found", { video_id: id });
      return toolResult({ success: true, video });
    }
  );

  server.registerTool(
    "get_video_status",
    {
      title: "Get video status",
      description: "Get just the current status of a video by id (cheaper than get_video for polling).",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ id }) => {
      const video = await getVideo(id);
      if (!video) return toolError("Video not found", { video_id: id });
      return toolResult({ success: true, id: video.id, status: video.status, updated_at: video.updated_at });
    }
  );

  server.registerTool(
    "move_video",
    {
      title: "Move video",
      description: "Change a video's status (e.g. move it to REJECTED or back to READY_FOR_REVIEW). Requires write access.",
      inputSchema: z.object({ id: z.string().uuid(), status: z.enum(VIDEO_STATUSES) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ id, status }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const video = await moveVideo(id, status, { source: "mcp_tool", userId, mcpToolName: "move_video" });
        return toolResult({ success: true, video });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to move video");
      }
    }
  );

  server.registerTool(
    "delete_video",
    {
      title: "Delete video",
      description: "Permanently delete a video and its storage files. Fails if the video has any publications. Requires write access.",
      inputSchema: z.object({ id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      const result = await deleteVideo(id, { source: "mcp_tool", userId, mcpToolName: "delete_video" });
      if (result.success === false) return toolError(result.error, { video_id: id });
      return toolResult({ success: true, video_id: id });
    }
  );
}
