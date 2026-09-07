import { createHmac } from "crypto";

/**
 * TikTok Shop Partner (Open) API request signature.
 *
 * Unlike eBay/Amazon (bearer token only), every TikTok Shop API call must carry an
 * HMAC-SHA256 `sign` query param computed from the request itself, or TikTok rejects
 * it outright. Algorithm (per TikTok's Partner Center docs):
 *   1. Sort all query params (excluding `sign` and `access_token`) by key, ASCII order.
 *   2. Concatenate as `${key}${value}` for each, back to back, no separators.
 *   3. Prepend the request path (e.g. "/order/202309/orders/search").
 *   4. Append the raw JSON body string, unless the request is multipart/form-data.
 *   5. Wrap the result between the app secret on both sides: `secret + input + secret`.
 *   6. HMAC-SHA256 that wrapped string with the app secret as key; hex digest is `sign`.
 */
export function signTikTokShopRequest({
  path,
  query,
  body,
  appSecret,
}: {
  path: string;
  query: Record<string, string>;
  body?: string;
  appSecret: string;
}): string {
  const sortedKeys = Object.keys(query)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();

  let input = path;
  for (const key of sortedKeys) {
    input += key + query[key];
  }
  if (body) {
    input += body;
  }
  const wrapped = appSecret + input + appSecret;

  return createHmac("sha256", appSecret).update(wrapped).digest("hex");
}
