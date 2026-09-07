import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_ACCESS_TOKEN ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type TikTokShopTokenRow = {
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string | null;
  shop_id: string | null;
  shop_cipher: string | null;
};

/**
 * Returns a valid access token plus the shop identifiers every TikTok Shop API call
 * needs (shop_id / shop_cipher, set during OAuth by tiktok-shop-oauth-callback).
 * Refreshes lazily, same pattern as getEbayAccessToken — TikTok access tokens are
 * short-lived (~7 days) while the refresh token lasts ~1 year.
 */
export async function getTikTokShopConnection(): Promise<TikTokShopTokenRow> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("tiktok_shop_tokens")
    .select("access_token, refresh_token, access_token_expires_at, shop_id, shop_cipher")
    .eq("environment", "production")
    .single();

  if (error || !data) {
    throw new Error("TikTok Shop not connected. Please connect your TikTok Shop account first.");
  }

  const expiresAt = data.access_token_expires_at
    ? new Date(data.access_token_expires_at).getTime()
    : 0;

  if (expiresAt > Date.now() + 60_000) {
    return data;
  }

  const appKey = process.env.TIKTOK_SHOP_APP_KEY!;
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET!;

  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: data.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch(`https://auth.tiktok-shops.com/api/v2/token/refresh?${params.toString()}`, {
    method: "GET",
  });

  const body = await res.json().catch(() => null);

  if (!res.ok || !body || body.code !== 0) {
    const errBody = JSON.stringify(body ?? { status: res.status });
    await supabase
      .from("tiktok_shop_tokens")
      .update({ last_refresh_error: errBody.slice(0, 2000), last_refresh_error_at: new Date().toISOString() })
      .eq("environment", "production");
    throw new Error("Failed to refresh TikTok Shop token. Please reconnect your account.");
  }

  const tok = body.data;
  const newExpiresAt = new Date(Date.now() + tok.access_token_expire_in * 1000).toISOString();

  await supabase
    .from("tiktok_shop_tokens")
    .update({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      access_token_expires_at: newExpiresAt,
      refresh_token_expires_at: new Date(Date.now() + tok.refresh_token_expire_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      last_refresh_error: null,
      last_refresh_error_at: null,
    })
    .eq("environment", "production");

  return {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    access_token_expires_at: newExpiresAt,
    shop_id: data.shop_id,
    shop_cipher: data.shop_cipher,
  };
}
