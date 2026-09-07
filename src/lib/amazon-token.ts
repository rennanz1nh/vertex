import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_ACCESS_TOKEN ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type AmazonConnection = {
  accessToken: string;
  sellerId: string | null;
  marketplaceId: string;
};

export async function getAmazonConnection(): Promise<AmazonConnection> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("amazon_tokens")
    .select("access_token, refresh_token, access_token_expires_at, seller_id, marketplace_id")
    .eq("environment", "production")
    .single();

  if (error || !data) {
    throw new Error("Amazon token not found. Please connect your Amazon account first.");
  }

  const expiresAt = data.access_token_expires_at
    ? new Date(data.access_token_expires_at).getTime()
    : 0;

  // Token still valid — return it directly
  if (expiresAt > Date.now() + 60_000) {
    return { accessToken: data.access_token, sellerId: data.seller_id, marketplaceId: data.marketplace_id ?? "ATVPDKIKX0DER" };
  }

  // Token expired — refresh it. Unlike eBay, Amazon's LWA (Login with Amazon) token
  // endpoint takes client_id/client_secret as body params, not a Basic auth header.
  const res = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
      client_id: process.env.AMAZON_CLIENT_ID!,
      client_secret: process.env.AMAZON_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh Amazon token. Please reconnect your account.");
  }

  const tokenData = await res.json();
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("amazon_tokens")
    .update({
      access_token: tokenData.access_token,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("environment", "production");

  return { accessToken: tokenData.access_token, sellerId: data.seller_id, marketplaceId: data.marketplace_id ?? "ATVPDKIKX0DER" };
}

export async function getAmazonAccessToken(): Promise<string> {
  return (await getAmazonConnection()).accessToken;
}
