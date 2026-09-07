import { NextRequest, NextResponse } from "next/server";
import { resolveClient } from "@/lib/mcp/oauth-store";
import { getAppUrl, getMcpResourceUrl } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

function errorRedirect(redirectUri: string, state: string | null, error: string, description: string) {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  url.searchParams.set("error_description", description);
  if (state) url.searchParams.set("state", state);
  return NextResponse.redirect(url);
}

/**
 * Authorization endpoint (RFC 6749 + PKCE, RFC 7636 — S256 required). This
 * route only validates the request is well-formed and the redirect_uri is
 * one the client actually registered — it does not have a session to
 * authenticate against (this app has no server-side cookie session, see
 * src/lib/admin-auth.ts), so it hands off to a login page that completes
 * the flow via /api/mcp/oauth/authorize/complete once the admin signs in.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const responseType = params.get("response_type");
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");
  const scope = params.get("scope");
  const state = params.get("state");
  const resource = params.get("resource");

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "client_id and redirect_uri are required" },
      { status: 400 }
    );
  }

  const client = await resolveClient(clientId);
  if (!client) {
    return NextResponse.json({ error: "invalid_client", error_description: "Unknown client_id" }, { status: 400 });
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    // Never redirect to an unregistered URI — this check exists precisely to prevent that.
    return NextResponse.json({ error: "invalid_request", error_description: "redirect_uri is not registered for this client" }, { status: 400 });
  }

  if (responseType !== "code") {
    return errorRedirect(redirectUri, state, "unsupported_response_type", "Only 'code' is supported");
  }
  if (!codeChallenge || codeChallengeMethod !== "S256") {
    return errorRedirect(redirectUri, state, "invalid_request", "PKCE with S256 is required");
  }
  if (resource) {
    const resourceUrl = new URL(resource);
    const expected = new URL(getMcpResourceUrl());
    if (resourceUrl.origin !== expected.origin || resourceUrl.pathname !== expected.pathname) {
      return errorRedirect(redirectUri, state, "invalid_target", "resource must be this MCP server's URL");
    }
  }

  const loginUrl = new URL("/admin/social-media/mcp-authorize", getAppUrl());
  loginUrl.searchParams.set("client_id", clientId);
  loginUrl.searchParams.set("redirect_uri", redirectUri);
  loginUrl.searchParams.set("code_challenge", codeChallenge);
  loginUrl.searchParams.set("scope", scope ?? "mcp:read");
  if (state) loginUrl.searchParams.set("state", state);
  if (client.client_name) loginUrl.searchParams.set("client_name", client.client_name);

  return NextResponse.redirect(loginUrl);
}
