import { NextRequest, NextResponse } from "next/server";
import { consumeAuthorizationCode, issueTokenPair, rotateRefreshToken } from "@/lib/mcp/oauth-store";
import { verifyPkce } from "@/lib/mcp/crypto";

export const dynamic = "force-dynamic";

async function readParams(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return typeof body === "object" && body ? body : {};
  }
  // RFC 6749 4.1.3 requires application/x-www-form-urlencoded — the primary path.
  const formData = await request.formData();
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

function tokenError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status });
}

export async function POST(request: NextRequest) {
  const params = await readParams(request);
  const grantType = params.grant_type;

  if (grantType === "authorization_code") {
    const { code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier } = params;
    if (!code || !redirectUri || !clientId || !codeVerifier) {
      return tokenError("invalid_request", "code, redirect_uri, client_id, and code_verifier are required");
    }

    const consumed = await consumeAuthorizationCode(code);
    if (!consumed) return tokenError("invalid_grant", "Authorization code is invalid, expired, or already used");

    if (consumed.client_id !== clientId || consumed.redirect_uri !== redirectUri) {
      return tokenError("invalid_grant", "client_id/redirect_uri do not match the authorization request");
    }
    if (!verifyPkce(codeVerifier, consumed.code_challenge)) {
      return tokenError("invalid_grant", "code_verifier does not match code_challenge");
    }

    const tokens = await issueTokenPair({ clientId, userId: consumed.user_id, scope: consumed.scope });
    return NextResponse.json({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: consumed.scope,
    });
  }

  if (grantType === "refresh_token") {
    const { refresh_token: refreshToken } = params;
    if (!refreshToken) return tokenError("invalid_request", "refresh_token is required");

    const tokens = await rotateRefreshToken(refreshToken);
    if (!tokens) return tokenError("invalid_grant", "Refresh token is invalid, expired, or revoked");

    return NextResponse.json({
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
    });
  }

  return tokenError("unsupported_grant_type", "Only authorization_code and refresh_token are supported");
}
