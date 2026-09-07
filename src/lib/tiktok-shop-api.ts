import { signTikTokShopRequest } from "@/lib/tiktok-shop-sign";
import { getTikTokShopConnection } from "@/lib/tiktok-shop-token";

const API_BASE = "https://open-api.tiktokglobalshop.com";

/**
 * Signed request to any TikTok Shop Partner API endpoint. Every call needs the same
 * boilerplate (app_key/timestamp/shop_cipher query params + HMAC sign + bearer access
 * token), so this is the single place that builds it — all TikTok Shop features
 * (listings, prices, inventory, fulfillment, orders) route through here.
 */
export async function tiktokShopRequest<T = unknown>({
  path,
  method = "GET",
  query = {},
  body,
}: {
  path: string;
  method?: "GET" | "POST" | "PUT";
  query?: Record<string, string>;
  body?: unknown;
}): Promise<T> {
  const appKey = process.env.TIKTOK_SHOP_APP_KEY!;
  const appSecret = process.env.TIKTOK_SHOP_APP_SECRET!;
  const conn = await getTikTokShopConnection();

  const bodyStr = body !== undefined ? JSON.stringify(body) : undefined;
  const baseQuery: Record<string, string> = {
    app_key: appKey,
    timestamp: String(Math.floor(Date.now() / 1000)),
    shop_cipher: conn.shop_cipher ?? "",
    ...query,
  };

  const sign = signTikTokShopRequest({ path, query: baseQuery, body: bodyStr, appSecret });
  const fullQuery = new URLSearchParams({ ...baseQuery, sign });

  const res = await fetch(`${API_BASE}${path}?${fullQuery.toString()}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-tts-access-token": conn.access_token,
    },
    body: bodyStr,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json || json.code !== 0) {
    const msg = json?.message ?? `TikTok Shop API error (${res.status})`;
    throw new Error(msg);
  }

  return json.data as T;
}
