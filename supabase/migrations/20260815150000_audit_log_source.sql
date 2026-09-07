-- audit_logs already existed (users/products/orders schema) but had no
-- writer wired up yet. The Social Media MCP is the first feature to use it,
-- and spec section 21 explicitly wants to know which MCP tool (vs. the Hub
-- UI, vs. a cron job) performed a write — there was no column for that.
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'hub_ui' CHECK (source IN ('hub_ui', 'mcp_tool', 'cron', 'system')),
  ADD COLUMN IF NOT EXISTS mcp_tool_name TEXT;
