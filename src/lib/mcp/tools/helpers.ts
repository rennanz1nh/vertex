import type { CallToolResult, ServerContext } from "@modelcontextprotocol/server";
import type { McpAuthExtra } from "../verify-token";

/**
 * MCP tool errors are reported in-band (`isError: true` in a normal
 * CallToolResult), not as transport failures — that's how the calling model
 * sees a clear explanation instead of an opaque connection error. Every tool
 * catches its own failures and routes them through toolError.
 */
export function toolResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function toolError(message: string, extra?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ success: false, error_message: message, ...extra }, null, 2) }],
    isError: true,
  };
}

export function getAuth(ctx: ServerContext): McpAuthExtra {
  const extra = ctx.http?.authInfo?.extra as unknown as McpAuthExtra | undefined;
  if (!extra) throw new Error("Missing authentication context");
  return extra;
}

export function hasWriteScope(ctx: ServerContext): boolean {
  return ctx.http?.authInfo?.scopes.includes("mcp:write") ?? false;
}
