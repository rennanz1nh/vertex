import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PLATFORM_CONFIG, isValidPlatform, redirectUriFor } from "@/lib/social-platforms";
import { fetchSocialProfile, fetchGrantedScopes } from "@/lib/social-profile";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Same safe-fallback rule as /authorize — `state` round-trips through the provider
 *  unmodified, but never trust it blindly. */
function safeReturnTo(value: unknown): string {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/admin/social-media/hub";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error") ?? url.searchParams.get("error_description");

  let returnTo = "/admin/social-media/hub";
  try {
    const decoded = JSON.parse(Buffer.from(url.searchParams.get("state") ?? "", "base64url").toString("utf8"));
    returnTo = safeReturnTo(decoded?.returnTo);
  } catch {
    // malformed/missing state — fall back to the HUB page
  }
  const joiner = returnTo.includes("?") ? "&" : "?";
  const redirectTo = (query: string) => NextResponse.redirect(new URL(`${returnTo}${joiner}${query}`, request.url));

  if (!isValidPlatform(platform)) return redirectTo("social_error=Plataforma%20desconhecida");
  const config = PLATFORM_CONFIG[platform];

  if (errorParam) return redirectTo(`social_error=${encodeURIComponent(errorParam)}&social_platform=${platform}`);
  if (!code) return redirectTo(`social_error=${encodeURIComponent("Código de autorização ausente")}&social_platform=${platform}`);

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) {
    return redirectTo(`social_error=${encodeURIComponent(`${config.label}: credenciais não configuradas`)}&social_platform=${platform}`);
  }

  try {
    const req = config.buildTokenRequest({ clientId, clientSecret, code, redirectUri: redirectUriFor(platform) });
    // Facebook's token exchange is documented as a GET with everything in the query
    // string (no body) — the other platforms are a real POST with a form body.
    const tokenRes = req.body
      ? await fetch(req.url, { method: "POST", headers: req.headers, body: req.body })
      : await fetch(req.url, { method: "GET" });
    const tokenData = await tokenRes.json();
    const parsed = tokenRes.ok ? config.parseTokenResponse(tokenData) : null;
    if (!parsed) {
      const msg = tokenData?.error_description || tokenData?.error?.message || tokenData?.error || "Falha ao trocar o código pelo token";
      return redirectTo(`social_error=${encodeURIComponent(msg)}&social_platform=${platform}`);
    }

    const { accessToken, refreshToken, expiresAt } = parsed;
    const [profile, granted] = await Promise.all([
      fetchSocialProfile(platform, accessToken),
      fetchGrantedScopes(platform, accessToken, typeof tokenData?.scope === "string" ? tokenData.scope : null),
    ]);

    const supabase = getSupabase();
    const { error: upsertError } = await supabase.from("social_media_accounts").upsert(
      {
        platform,
        account_id: profile.accountId,
        account_name: profile.accountName,
        avatar_url: profile.avatarUrl,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        scopes: granted.scopes,
        can_publish: granted.canPublish,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform" }
    );
    if (upsertError) return redirectTo(`social_error=${encodeURIComponent(upsertError.message)}&social_platform=${platform}`);

    return redirectTo(`social_connected=${platform}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return redirectTo(`social_error=${encodeURIComponent(msg)}&social_platform=${platform}`);
  }
}
