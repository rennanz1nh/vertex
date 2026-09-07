import { supabaseAdmin } from "@/lib/supabase-admin";
import { fetchClientIdMetadata } from "./cimd";
import { generateOpaqueToken, hashToken } from "./crypto";
import {
  MCP_ACCESS_TOKEN_TTL_SECONDS,
  MCP_AUTHORIZATION_CODE_TTL_SECONDS,
  MCP_REFRESH_TOKEN_TTL_SECONDS,
  type McpScope,
} from "./config";

export interface McpOAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
  registration_source: "dcr" | "cimd" | "manual";
  token_endpoint_auth_method: string;
}

/**
 * Resolves a client_id to its registered redirect URIs — either a
 * previously-registered client (DCR, or a CIMD document fetched on a prior
 * request) or, when the id is an untried `https://` URL, a fresh CIMD fetch.
 * Returns null when the client is unknown and not a fetchable CIMD URL.
 */
export async function resolveClient(clientId: string): Promise<McpOAuthClient | null> {
  const { data: existing } = await supabaseAdmin
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris, registration_source, token_endpoint_auth_method")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) return existing as McpOAuthClient;

  if (!clientId.startsWith("https://")) return null;

  const metadata = await fetchClientIdMetadata(clientId);
  if (!metadata) return null;

  const { data: inserted, error } = await supabaseAdmin
    .from("mcp_oauth_clients")
    .insert({
      client_id: metadata.client_id,
      client_name: metadata.client_name ?? null,
      redirect_uris: metadata.redirect_uris,
      registration_source: "cimd",
      token_endpoint_auth_method: "none",
    })
    .select("client_id, client_name, redirect_uris, registration_source, token_endpoint_auth_method")
    .single();

  if (error || !inserted) return null;
  return inserted as McpOAuthClient;
}

export async function registerDcrClient(params: {
  clientName?: string;
  redirectUris: string[];
}): Promise<McpOAuthClient> {
  const clientId = `mcp_${generateOpaqueToken()}`;
  const { data, error } = await supabaseAdmin
    .from("mcp_oauth_clients")
    .insert({
      client_id: clientId,
      client_name: params.clientName ?? null,
      redirect_uris: params.redirectUris,
      registration_source: "dcr",
      token_endpoint_auth_method: "none",
    })
    .select("client_id, client_name, redirect_uris, registration_source, token_endpoint_auth_method")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to register client");
  return data as McpOAuthClient;
}

export async function createAuthorizationCode(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: McpScope[];
  userId: string;
}): Promise<string> {
  const code = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + MCP_AUTHORIZATION_CODE_TTL_SECONDS * 1000).toISOString();

  const { error } = await supabaseAdmin.from("mcp_oauth_authorization_codes").insert({
    code_hash: hashToken(code),
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    scope: params.scope.join(" "),
    user_id: params.userId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);
  return code;
}

export interface ConsumedAuthorizationCode {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  scope: string;
  user_id: string;
}

/** Atomically claims and returns the code row, or null if unknown/expired/already used (single-use enforced by the used_at IS NULL filter on the update). */
export async function consumeAuthorizationCode(rawCode: string): Promise<ConsumedAuthorizationCode | null> {
  const { data, error } = await supabaseAdmin
    .from("mcp_oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", hashToken(rawCode))
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("client_id, redirect_uri, code_challenge, scope, user_id")
    .maybeSingle();
  if (error || !data) return null;
  return data as ConsumedAuthorizationCode;
}

export interface McpTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueTokenPair(params: {
  clientId: string;
  userId: string;
  scope: string;
}): Promise<McpTokenPair> {
  const accessToken = generateOpaqueToken();
  const refreshToken = generateOpaqueToken();
  const now = Date.now();

  const { error } = await supabaseAdmin.from("mcp_oauth_tokens").insert({
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    client_id: params.clientId,
    user_id: params.userId,
    scope: params.scope,
    expires_at: new Date(now + MCP_ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString(),
    refresh_expires_at: new Date(now + MCP_REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new Error(error.message);

  return { accessToken, refreshToken, expiresIn: MCP_ACCESS_TOKEN_TTL_SECONDS };
}

export interface VerifiedMcpToken {
  clientId: string;
  userId: string;
  scope: string;
  expiresAt: string;
}

export async function verifyAccessToken(rawToken: string): Promise<VerifiedMcpToken | null> {
  const { data, error } = await supabaseAdmin
    .from("mcp_oauth_tokens")
    .select("client_id, user_id, scope, expires_at, revoked_at")
    .eq("access_token_hash", hashToken(rawToken))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() <= Date.now()) return null;

  // Best-effort — a dropped update here should never fail authentication.
  void supabaseAdmin
    .from("mcp_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("access_token_hash", hashToken(rawToken))
    .then(() => {});

  return { clientId: data.client_id, userId: data.user_id, scope: data.scope, expiresAt: data.expires_at };
}

/** Rotates a refresh token: the old one is revoked and a new pair issued, so a stolen-and-reused refresh token is detectable (both rotations would then fail). */
export async function rotateRefreshToken(rawRefreshToken: string): Promise<McpTokenPair | null> {
  const tokenHash = hashToken(rawRefreshToken);
  const { data: existing, error } = await supabaseAdmin
    .from("mcp_oauth_tokens")
    .select("id, client_id, user_id, scope, refresh_expires_at, revoked_at")
    .eq("refresh_token_hash", tokenHash)
    .maybeSingle();
  if (error || !existing) return null;
  if (existing.revoked_at) return null;
  if (!existing.refresh_expires_at || new Date(existing.refresh_expires_at).getTime() <= Date.now()) return null;

  const { error: revokeError } = await supabaseAdmin
    .from("mcp_oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", existing.id);
  if (revokeError) return null;

  return issueTokenPair({ clientId: existing.client_id, userId: existing.user_id, scope: existing.scope });
}

export async function getUserRole(userId: string): Promise<"admin" | "operador" | "leitura" | null> {
  const { data, error } = await supabaseAdmin.from("profiles").select("role").eq("user_id", userId).maybeSingle();
  if (error || !data) return null;
  return data.role as "admin" | "operador" | "leitura";
}
