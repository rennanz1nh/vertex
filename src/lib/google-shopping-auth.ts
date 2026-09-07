import { createClient } from "@supabase/supabase-js";
import { createSign } from "node:crypto";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type ServiceAccount = { client_email: string; private_key: string };

/**
 * Unlike eBay (OAuth redirect) and Amazon (refresh token from Seller Central),
 * the Merchant API authenticates as a service account: no user ever grants consent,
 * the service account's email is added as a user on the Merchant Center account instead
 * (Merchant Center UI → Settings → Account access). GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON
 * holds the full JSON key downloaded from Google Cloud Console for that service account —
 * server-only env var, same trust level as EBAY_CERT_ID / AMAZON_CLIENT_SECRET.
 */
function loadServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON não configurado no servidor.");
  }
  let parsed: Partial<ServiceAccount>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON não é um JSON válido.");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON não contém client_email/private_key.");
  }
  return { client_email: parsed.client_email, private_key: parsed.private_key };
}

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString("base64url");
}

/**
 * Signs a JWT-bearer assertion (RS256) and exchanges it for an access token — the
 * OAuth2 service-account flow (https://oauth2.googleapis.com/token, grant_type
 * urn:ietf:params:oauth:grant-type:jwt-bearer). No SDK: same "plain fetch" convention
 * the eBay/Amazon integrations use, just with a hand-signed assertion instead of a
 * stored refresh token.
 */
async function mintAccessToken(): Promise<{ accessToken: string; expiresAt: string }> {
  const { client_email, private_key } = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/content",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao gerar token do Google (service account): ${body}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

export type GoogleShoppingConnection = {
  accessToken: string;
  merchantId: string;
  dataSourceName: string | null;
  feedLabel: string | null;
  contentLanguage: string | null;
};

/** DB-cached access token, refreshed on demand — mirrors getAmazonConnection's shape. */
export async function getGoogleShoppingConnection(): Promise<GoogleShoppingConnection> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("google_shopping_tokens")
    .select("merchant_id, data_source_name, feed_label, content_language, access_token, access_token_expires_at")
    .eq("environment", "production")
    .single();

  if (error || !data) {
    throw new Error("Conta do Google Shopping não conectada. Configure o Merchant Center ID primeiro.");
  }

  const base = {
    merchantId: data.merchant_id,
    dataSourceName: data.data_source_name,
    feedLabel: data.feed_label,
    contentLanguage: data.content_language,
  };

  const expiresAt = data.access_token_expires_at ? new Date(data.access_token_expires_at).getTime() : 0;
  if (data.access_token && expiresAt > Date.now() + 60_000) {
    return { accessToken: data.access_token, ...base };
  }

  const { accessToken, expiresAt: newExpiresAt } = await mintAccessToken();
  await supabase
    .from("google_shopping_tokens")
    .update({
      access_token: accessToken,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("environment", "production");

  return { accessToken, ...base };
}

/** Caches the discovered data source alongside the feedLabel/contentLanguage it was
 *  actually configured with — every product submitted through it must match those
 *  exactly (Google rejects any other combination), so this can never be hardcoded. */
export async function saveDataSource(dataSourceName: string, feedLabel: string, contentLanguage: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("google_shopping_tokens")
    .update({
      data_source_name: dataSourceName,
      feed_label: feedLabel,
      content_language: contentLanguage,
      updated_at: new Date().toISOString(),
    })
    .eq("environment", "production");
}
