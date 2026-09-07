import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { toolResult, toolError } from "./helpers";

const SOCIAL_PLATFORMS = ["instagram", "tiktok", "facebook", "youtube", "pinterest"] as const;

// Never selects access_token/refresh_token — same rule the existing
// /api/social/status route follows (src/app/api/social/status/route.ts).
const ACCOUNT_COLUMNS =
  "id, platform, account_id, account_name, avatar_url, account_type, can_publish, auto_publish_authorized, connected_at, updated_at";

/** Read-only account tools (spec section 11: ACCOUNT TOOLS, read half). connect/disconnect land with Phase 8/9 alongside the platform adapters that give them something real to do. */
export function registerAccountTools(server: McpServer) {
  server.registerTool(
    "list_social_accounts",
    {
      title: "List social accounts",
      description: "List every connected social media account across all platforms, and whether each can publish.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      const { data, error } = await supabaseAdmin.from("social_media_accounts").select(ACCOUNT_COLUMNS);
      if (error) return toolError(error.message);
      return toolResult({ success: true, accounts: data });
    }
  );

  server.registerTool(
    "get_account_status",
    {
      title: "Get account status",
      description: "Get the connection status for one platform (connected account, or not connected).",
      inputSchema: z.object({ platform: z.enum(SOCIAL_PLATFORMS) }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ platform }) => {
      const { data, error } = await supabaseAdmin.from("social_media_accounts").select(ACCOUNT_COLUMNS).eq("platform", platform).maybeSingle();
      if (error) return toolError(error.message);
      if (!data) return toolResult({ success: true, platform, connected: false });
      return toolResult({ success: true, platform, connected: true, account: data });
    }
  );
}
