import type { McpServer } from "@modelcontextprotocol/server";
import { registerVideoTools } from "./tools/video-tools";
import { registerAccountTools } from "./tools/account-tools";
import { registerContentTools } from "./tools/content-tools";
import { registerPublicationTools } from "./tools/publication-tools";
import { registerMetricsTools } from "./tools/metrics-tools";
import { registerPipelineTools } from "./tools/pipeline-tools";

/**
 * Registers every Social Media MCP tool. New tools are added here as each
 * implementation phase lands real backing logic in src/lib — see AGENTS.md
 * phase plan. Read and write tools are both registered through this one
 * entry point; the read/write split (spec section 12) lives in each tool's
 * `annotations.readOnlyHint` and in the per-tool scope check inside write
 * tool handlers, not in a separate registration path.
 */
export function initializeSocialMediaMcpServer(server: McpServer) {
  registerVideoTools(server);
  registerAccountTools(server);
  registerContentTools(server);
  registerPublicationTools(server);
  registerMetricsTools(server);
  registerPipelineTools(server);
}
