import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Service role key allows writes past RLS; falls back to anon for read-only status checks
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.SUPABASE_ACCESS_TOKEN ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function getEbayAccessToken(): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("ebay_tokens")
    .select("access_token, refresh_token, access_token_expires_at")
    .eq("environment", "production")
    .single();

  if (error || !data) {
    throw new Error("eBay token not found. Please connect your eBay account first.");
  }

  const expiresAt = data.access_token_expires_at
    ? new Date(data.access_token_expires_at).getTime()
    : 0;

  // Token still valid — return it directly
  if (expiresAt > Date.now() + 60_000) {
    return data.access_token;
  }

  // Token expired — refresh it
  const appId = process.env.EBAY_APP_ID!;
  const certId = process.env.EBAY_CERT_ID ?? process.env.EBAY_CLIENT_SECRET!;
  const credentials = Buffer.from(`${appId}:${certId}`).toString("base64");

  const res = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: data.refresh_token,
    }),
  });

  if (!res.ok) {
    // Previously this discarded eBay's actual response body, making it impossible to
    // tell a genuinely expired/revoked refresh_token apart from a credential
    // misconfiguration or a transient eBay-side error after the fact. Persist it so the
    // next investigation starts from eBay's real error instead of a guess.
    const errBody = await res.text();
    await supabase
      .from("ebay_tokens")
      .update({ last_refresh_error: errBody.slice(0, 2000), last_refresh_error_at: new Date().toISOString() })
      .eq("environment", "production");
    // Full history (every attempt, not just the latest) — lets us tell later whether
    // disconnects are a one-off or a recurring pattern. Never allowed to break the
    // actual refresh flow if the insert itself fails.
    await supabase.from("ebay_token_refresh_log").insert({ success: false, error: errBody.slice(0, 2000) }).then(null, () => {});
    throw new Error("Failed to refresh eBay token. Please reconnect your account.");
  }

  const tokenData = await res.json();
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("ebay_tokens")
    .update({
      access_token: tokenData.access_token,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
      // A successful refresh clears any stale diagnostic from a previous failure —
      // last_refresh_error should only ever reflect the current problem, if any.
      last_refresh_error: null,
      last_refresh_error_at: null,
    })
    .eq("environment", "production");
  await supabase.from("ebay_token_refresh_log").insert({ success: true, new_expires_at: newExpiresAt }).then(null, () => {});

  return tokenData.access_token;
}
