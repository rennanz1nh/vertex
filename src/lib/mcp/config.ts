/** Every scope the Social Media MCP understands. Tools declare which one they require. */
export const MCP_SCOPES = ["mcp:read", "mcp:write"] as const;
export type McpScope = (typeof MCP_SCOPES)[number];

export const MCP_ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const MCP_AUTHORIZATION_CODE_TTL_SECONDS = 60 * 5; // 5 minutes, single use

/**
 * Base URL for this deployment. Required for the OAuth issuer/resource
 * identifiers, which per RFC 8414/9728 must be stable absolute URLs — not
 * derived per-request — even though mcp-handler can infer a request's
 * public origin for other purposes.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL must be set to run the Social Media MCP OAuth endpoints.");
  }
  return url.replace(/\/+$/, "");
}

export function getMcpResourceUrl(): string {
  return `${getAppUrl()}/api/mcp`;
}

/** Non-throwing variant for module-scope use (e.g. wrapping the MCP handler at import time) — a missing env var there must not crash route collection for the whole app. */
export function tryGetMcpResourceUrl(): string | undefined {
  try {
    return getMcpResourceUrl();
  } catch {
    return undefined;
  }
}

/** Non-throwing origin-only variant — see route.ts's withMcpAuth call for why this (not tryGetMcpResourceUrl) is what belongs in its `resourceUrl` option. */
export function tryGetAppUrl(): string | undefined {
  try {
    return getAppUrl();
  } catch {
    return undefined;
  }
}

export function getMcpIssuerUrl(): string {
  return `${getAppUrl()}/api/mcp/oauth`;
}

export function parseScope(raw: string | null | undefined): McpScope[] {
  if (!raw) return ["mcp:read"];
  const requested = raw.split(/\s+/).filter(Boolean);
  const valid = requested.filter((s): s is McpScope => (MCP_SCOPES as readonly string[]).includes(s));
  return valid.length > 0 ? Array.from(new Set(valid)) : ["mcp:read"];
}
