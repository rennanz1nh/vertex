/**
 * Central config for the Social Media HUB's OAuth connections. One connected account per
 * platform (reconnecting swaps it). Instagram and TikTok's scopes now also request
 * publish permission (instagram_content_publish / video.publish) for the Social Media MCP
 * (see src/lib/social-media/) — the other three platforms stay read-only (metrics only),
 * since there's no publishing adapter for them yet. An account connected before the
 * publish scopes were added needs to be reconnected to pick them up; the token granted at
 * the old, narrower consent screen doesn't retroactively gain the new permission.
 *
 * Every platform needs a developer app registered by hand (Meta App, TikTok for
 * Developers, Google Cloud project, Pinterest app) before its "Conectar" button works —
 * the env vars below are where those credentials go. Until they're set, /authorize
 * returns a clear "not configured" error instead of a broken redirect.
 */

export type SocialPlatform = "instagram" | "tiktok" | "facebook" | "youtube" | "pinterest";

export const SOCIAL_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok", "facebook", "youtube", "pinterest"];

export interface TokenExchangeRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
}

export interface PlatformConfig {
  id: SocialPlatform;
  label: string;
  /** Env var names holding the OAuth app credentials. */
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Builds the provider's authorization URL. */
  authUrl: (params: { clientId: string; redirectUri: string; state: string }) => string;
  /** Each provider names/authenticates the token exchange differently (TikTok uses
   *  `client_key`, Pinterest uses HTTP Basic auth) — kept per-platform instead of forcing
   *  a single shared shape that would silently be wrong for some of them. */
  buildTokenRequest: (params: { clientId: string; clientSecret: string; code: string; redirectUri: string }) => TokenExchangeRequest;
  parseTokenResponse: (data: any) => TokenResult | null;
}

const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vertexrentalcars.com";

export function redirectUriFor(platform: SocialPlatform): string {
  return `${APP_BASE_URL}/api/social/${platform}/callback`;
}

function expiresAtFromSeconds(seconds: unknown): string | null {
  const n = Number(seconds);
  return Number.isFinite(n) && n > 0 ? new Date(Date.now() + n * 1000).toISOString() : null;
}

export const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  instagram: {
    id: "instagram",
    label: "Instagram",
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    authUrl: ({ clientId, redirectUri, state }) =>
      `https://www.facebook.com/v19.0/dialog/oauth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: "instagram_basic,instagram_manage_insights,instagram_content_publish,pages_show_list,pages_read_engagement",
        response_type: "code",
      })}`,
    buildTokenRequest: ({ clientId, clientSecret, code, redirectUri }) => ({
      url: `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      })}`,
      headers: {},
      body: "",
    }),
    parseTokenResponse: (data) =>
      data?.access_token
        ? { accessToken: data.access_token, refreshToken: null, expiresAt: expiresAtFromSeconds(data.expires_in) }
        : null,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    authUrl: ({ clientId, redirectUri, state }) =>
      `https://www.facebook.com/v19.0/dialog/oauth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: "pages_show_list,pages_read_engagement,read_insights",
        response_type: "code",
      })}`,
    buildTokenRequest: ({ clientId, clientSecret, code, redirectUri }) => ({
      url: `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      })}`,
      headers: {},
      body: "",
    }),
    parseTokenResponse: (data) =>
      data?.access_token
        ? { accessToken: data.access_token, refreshToken: null, expiresAt: expiresAtFromSeconds(data.expires_in) }
        : null,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    authUrl: ({ clientId, redirectUri, state }) =>
      `https://www.tiktok.com/v2/auth/authorize?${new URLSearchParams({
        client_key: clientId,
        redirect_uri: redirectUri,
        state,
        scope: "user.info.basic,video.list,video.publish",
        response_type: "code",
      })}`,
    buildTokenRequest: ({ clientId, clientSecret, code, redirectUri }) => ({
      url: "https://open.tiktokapis.com/v2/oauth/token/",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    }),
    parseTokenResponse: (data) =>
      data?.access_token
        ? { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: expiresAtFromSeconds(data.expires_in) }
        : null,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    clientIdEnv: "GOOGLE_YOUTUBE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_YOUTUBE_CLIENT_SECRET",
    authUrl: ({ clientId, redirectUri, state }) =>
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly",
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
      })}`,
    buildTokenRequest: ({ clientId, clientSecret, code, redirectUri }) => ({
      url: "https://oauth2.googleapis.com/token",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }).toString(),
    }),
    parseTokenResponse: (data) =>
      data?.access_token
        ? { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: expiresAtFromSeconds(data.expires_in) }
        : null,
  },
  pinterest: {
    id: "pinterest",
    label: "Pinterest",
    clientIdEnv: "PINTEREST_APP_ID",
    clientSecretEnv: "PINTEREST_APP_SECRET",
    authUrl: ({ clientId, redirectUri, state }) =>
      `https://www.pinterest.com/oauth/?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: "boards:read,pins:read,user_accounts:read",
        response_type: "code",
      })}`,
    // Pinterest v5 authenticates the token exchange with HTTP Basic (client_id:client_secret)
    // rather than putting the secret in the body.
    buildTokenRequest: ({ clientId, clientSecret, code, redirectUri }) => ({
      url: "https://api.pinterest.com/v5/oauth/token",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    }),
    parseTokenResponse: (data) =>
      data?.access_token
        ? { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: expiresAtFromSeconds(data.expires_in) }
        : null,
  },
};

export function isValidPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as string[]).includes(value);
}
