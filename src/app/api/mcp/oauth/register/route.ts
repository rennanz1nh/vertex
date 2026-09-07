import { NextRequest, NextResponse } from "next/server";
import { registerDcrClient } from "@/lib/mcp/oauth-store";
import { isAllowedRedirectUri } from "@/lib/mcp/redirect-uri";

export const dynamic = "force-dynamic";

// RFC 7591 Dynamic Client Registration. Kept available alongside CIMD
// (see src/lib/mcp/cimd.ts) since the 2026-07-28 spec deprecates DCR but
// does not forbid it, and older/other MCP clients still expect it.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata", error_description: "Body must be JSON" }, { status: 400 });
  }

  const { redirect_uris, client_name } = (body ?? {}) as { redirect_uris?: unknown; client_name?: unknown };

  if (!Array.isArray(redirect_uris) || redirect_uris.length === 0 || !redirect_uris.every((u) => typeof u === "string")) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris must be a non-empty array of strings" },
      { status: 400 }
    );
  }
  if (!redirect_uris.every(isAllowedRedirectUri)) {
    return NextResponse.json(
      { error: "invalid_redirect_uri", error_description: "Each redirect_uri must be https, or a loopback http URL" },
      { status: 400 }
    );
  }

  const client = await registerDcrClient({
    clientName: typeof client_name === "string" ? client_name : undefined,
    redirectUris: redirect_uris,
  });

  return NextResponse.json({
    client_id: client.client_id,
    client_name: client.client_name,
    redirect_uris: client.redirect_uris,
    token_endpoint_auth_method: client.token_endpoint_auth_method,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_id_issued_at: Math.floor(Date.now() / 1000),
  });
}
