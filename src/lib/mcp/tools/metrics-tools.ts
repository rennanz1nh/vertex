import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { getPublicationMetrics, getMetricsHistory, getPerformanceOverview } from "@/lib/social-media/metrics-service";
import { SOCIAL_PLATFORMS } from "@/lib/social-media/types";
import { toolResult, toolError } from "./helpers";

/**
 * Read-only metrics/analytics tools (spec sections 2/16). Every number here
 * is exactly what social_post_metrics/_history holds — a field the platform
 * hasn't reported yet (or a post too new to have synced) stays null, never
 * a guessed or zeroed value.
 */
export function registerMetricsTools(server: McpServer) {
  server.registerTool(
    "get_publication_metrics",
    {
      title: "Get publication metrics",
      description:
        "Get the latest metrics snapshot for one publication (views/likes/comments/shares/saves/reach/engagement/watch time). Fields the platform hasn't reported are null, not zero.",
      inputSchema: z.object({ publication_id: z.string().uuid() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ publication_id }) => {
      try {
        const metrics = await getPublicationMetrics(publication_id);
        if (!metrics) return toolResult({ success: true, publication_id, metrics: null, note: "No metrics synced yet for this publication." });
        return toolResult({ success: true, publication_id, metrics });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to get metrics");
      }
    }
  );

  server.registerTool(
    "get_metrics_history",
    {
      title: "Get metrics history",
      description: "Get the full time-series of metrics snapshots for one publication, oldest first — for charting growth rather than just reading the latest number.",
      inputSchema: z.object({ publication_id: z.string().uuid(), limit: z.number().int().min(1).max(500).default(100) }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ publication_id, limit }) => {
      try {
        const history = await getMetricsHistory(publication_id, limit);
        return toolResult({ success: true, publication_id, history });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to get metrics history");
      }
    }
  );

  server.registerTool(
    "analyze_content_performance",
    {
      title: "Analyze content performance",
      description:
        "Get published videos together with their latest metrics, ranked by engagement, so patterns across posts can be compared (e.g. 'what's working on TikTok'). Returns real synced numbers for the calling model to interpret — this tool does not itself draw conclusions.",
      inputSchema: z.object({
        platform: z.enum(SOCIAL_PLATFORMS).optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ platform, limit }) => {
      try {
        const publications = await getPerformanceOverview({ platform, limit });
        if (publications.length === 0) {
          return toolResult({ success: true, count: 0, publications: [], note: "No published content yet." });
        }
        return toolResult({ success: true, count: publications.length, publications });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : "Failed to analyze content performance");
      }
    }
  );
}
