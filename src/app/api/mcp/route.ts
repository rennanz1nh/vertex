import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { initializeSocialMediaMcpServer } from "@/lib/mcp/server";
import { verifyMcpToken } from "@/lib/mcp/verify-token";
import { tryGetAppUrl } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";
// publish_publication can poll a platform for up to ~60s before even trying
// the final publish call — 60s total was too tight once that tool landed.
// 300s needs at least a Vercel Pro plan; on Hobby this is silently clamped
// to whatever that plan allows, so a slow publish may still need a retry.
export const maxDuration = 300;

const handler = createMcpHandler(
  (server) => {
    initializeSocialMediaMcpServer(server);
  },
  {
    serverInfo: { name: "social-media-mcp", version: "0.1.0" },
  }
);

const authedHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  requiredScopes: ["mcp:read"],
  // mcp-handler builds the WWW-Authenticate resource_metadata URL as
  // `${resourceUrl}${resourceMetadataPath}` verbatim (see its auth-wrapper
  // source) — resourceUrl must be origin-only here, not the full /api/mcp
  // resource URL, or the two concatenate into a path that nothing serves.
  // resourceMetadataPath is pinned to match exactly what the
  // src/app/.well-known/[...slug] catch-all actually serves via
  // @modelcontextprotocol/server's oauthMetadataResponse (RFC 9728's
  // path-appended convention) — confirmed by curling both URLs locally,
  // since the two libraries default to different conventions and silently
  // disagreeing here would 404 every real MCP client's OAuth discovery.
  resourceUrl: tryGetAppUrl(),
  resourceMetadataPath: "/.well-known/oauth-protected-resource/api/mcp",
});

export { authedHandler as GET, authedHandler as POST };
