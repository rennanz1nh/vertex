import { z } from "zod";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import {
  approvePublication,
  cancelScheduledPublication,
  createPublication,
  getPublication,
  listPublications,
  previewPublication,
  rejectPublication,
  schedulePublication,
} from "@/lib/social-media/publication-service";
import { publishPublication } from "@/lib/social-media/publish-service";
import { maybeAutoApproveAndPublish } from "@/lib/social-media/auto-publish-service";
import { APPROVAL_STATUSES, PUBLICATION_STATUSES, SOCIAL_PLATFORMS } from "@/lib/social-media/types";
import { toolResult, toolError, getAuth, hasWriteScope } from "./helpers";

/** Human-review, publishing, and scheduling workflow (spec sections 4/13/14/15/26/27). */
export function registerPublicationTools(server: McpServer) {
  server.registerTool(
    "create_publication",
    {
      title: "Create publication",
      description:
        "Create a pending-approval publication for a video on one platform/account, using the platform content already generated for it. Idempotent: a repeat call for the same video+platform+account returns the existing publication. If AUTO publish mode is on for this account, it may already show as approved/published by the time this call returns. Requires write access.",
      inputSchema: z.object({
        video_id: z.string().uuid(),
        platform: z.enum(SOCIAL_PLATFORMS),
        account_id: z.string().uuid(),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ video_id, platform, account_id }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const result = await createPublication({ videoId: video_id, platform, accountId: account_id, actor: { source: "mcp_tool", userId, mcpToolName: "create_publication" } });
        await maybeAutoApproveAndPublish(result.publication.id);
        const finalPublication = (await getPublication(result.publication.id)) ?? result.publication;
        return toolResult({ success: true, publication: finalPublication, already_existed: result.isExisting });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to create publication");
      }
    }
  );

  server.registerTool(
    "preview_publication",
    {
      title: "Preview publication",
      description: "Get everything needed to review a publication before approving: video, generated caption/hashtags, and target account.",
      inputSchema: z.object({ publication_id: z.string().uuid() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ publication_id }) => {
      const preview = await previewPublication(publication_id);
      if (!preview) return toolError("Publication not found", { publication_id });
      return toolResult({ success: true, ...preview });
    }
  );

  server.registerTool(
    "approve_publication",
    {
      title: "Approve publication",
      description: "Approve a pending publication so it becomes eligible to publish (or schedule). Requires write access.",
      inputSchema: z.object({ publication_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ publication_id }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const publication = await approvePublication(publication_id, { source: "mcp_tool", userId, mcpToolName: "approve_publication" });
        return toolResult({ success: true, publication });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to approve publication");
      }
    }
  );

  server.registerTool(
    "reject_publication",
    {
      title: "Reject publication",
      description: "Reject a pending publication with a reason. Requires write access.",
      inputSchema: z.object({ publication_id: z.string().uuid(), reason: z.string().min(1) }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ publication_id, reason }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const publication = await rejectPublication(publication_id, reason, { source: "mcp_tool", userId, mcpToolName: "reject_publication" });
        return toolResult({ success: true, publication });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to reject publication");
      }
    }
  );

  server.registerTool(
    "publish_publication",
    {
      title: "Publish publication",
      description:
        "Publish an approved video to its target platform right now, via the official Instagram Graph API or TikTok Content Posting API. Refuses to run if the publication hasn't been human-approved. Safe to call more than once for the same publication — it will never publish the same video twice; a repeat call returns the existing outcome instead. Requires write access.",
      inputSchema: z.object({ publication_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ publication_id }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const result = await publishPublication(publication_id, { source: "mcp_tool", userId, mcpToolName: "publish_publication" });
        if (result.outcome === "failed") {
          return toolError(result.errorMessage ?? "Publishing failed", {
            publication_id,
            status: result.publication.status,
            error_code: result.publication.error_code,
            retry_count: result.publication.retry_count,
          });
        }
        return toolResult({
          success: true,
          outcome: result.outcome,
          publication_id: result.publication.id,
          status: result.publication.status,
          platform_post_id: result.publication.platform_post_id,
          url: result.publication.permalink,
        });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to publish");
      }
    }
  );

  server.registerTool(
    "schedule_publication",
    {
      title: "Schedule publication",
      description:
        "Schedule an already-approved publication to go out automatically at a future date/time. A background worker publishes it when the time comes — this does not depend on Claude or the browser staying open. Requires write access.",
      inputSchema: z.object({
        publication_id: z.string().uuid(),
        scheduled_at: z.string().describe("Future date/time in ISO 8601 (e.g. 2026-08-20T14:30:00Z)"),
        timezone: z.string().default("UTC").describe("IANA timezone name for display purposes, e.g. 'America/Sao_Paulo'"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ publication_id, scheduled_at, timezone }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const publication = await schedulePublication(publication_id, scheduled_at, timezone, {
          source: "mcp_tool",
          userId,
          mcpToolName: "schedule_publication",
        });
        return toolResult({ success: true, publication });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to schedule publication");
      }
    }
  );

  server.registerTool(
    "cancel_scheduled_publication",
    {
      title: "Cancel scheduled publication",
      description: "Cancel a publication's schedule. It stays approved (not rejected) and can be published immediately or rescheduled later. Requires write access.",
      inputSchema: z.object({ publication_id: z.string().uuid() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ publication_id }, ctx: ServerContext) => {
      if (!hasWriteScope(ctx)) return toolError("This action requires write access (mcp:write scope)");
      const { userId } = getAuth(ctx);
      try {
        const publication = await cancelScheduledPublication(publication_id, { source: "mcp_tool", userId, mcpToolName: "cancel_scheduled_publication" });
        return toolResult({ success: true, publication });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to cancel schedule");
      }
    }
  );

  server.registerTool(
    "get_publication_status",
    {
      title: "Get publication status",
      description: "Get the current status and approval state of a publication.",
      inputSchema: z.object({ publication_id: z.string().uuid() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ publication_id }) => {
      const publication = await getPublication(publication_id);
      if (!publication) return toolError("Publication not found", { publication_id });
      return toolResult({
        success: true,
        publication_id: publication.id,
        status: publication.status,
        approval_status: publication.approval_status,
        platform: publication.platform,
        published_at: publication.published_at,
        url: publication.permalink,
      });
    }
  );

  server.registerTool(
    "list_publications",
    {
      title: "List publications",
      description: "List publications, optionally filtered by status, approval status, or video. Useful for e.g. 'show me what's waiting for approval'.",
      inputSchema: z.object({
        status: z.enum(PUBLICATION_STATUSES).optional(),
        approval_status: z.enum(APPROVAL_STATUSES).optional(),
        video_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ status, approval_status, video_id, limit }) => {
      const publications = await listPublications({ status, approvalStatus: approval_status, videoId: video_id, limit });
      return toolResult({ success: true, publications });
    }
  );
}
