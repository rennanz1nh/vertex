import { createClient } from "@supabase/supabase-js";
import { createSign } from "node:crypto";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

type ServiceAccount = { client_email: string; private_key: string };

/**
 * Reuses the same GCP service account already configured for the Merchant API (Google
 * Shopping) — GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON. Same GCP project, same key; the only
 * difference is the OAuth scope requested at mint time. No new secret to configure — the
 * one manual step is adding this service account's email as a user on the Search Console
 * property (Settings > Users and permissions in Search Console).
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

/** The service account's email — safe to expose (it's what the user pastes into Search
 *  Console's "Add user" dialog, not a secret in itself). */
export function getServiceAccountEmail(): string {
  return loadServiceAccount().client_email;
}

async function mintAccessToken(): Promise<{ accessToken: string; expiresAt: string }> {
  const { client_email, private_key } = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: client_email,
    // Full (not read-only) scope so sitemap resubmission works too, not just reporting.
    scope: "https://www.googleapis.com/auth/webmasters",
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

export type SearchConsoleConnection = { accessToken: string; siteUrl: string };

/** DB-cached access token, refreshed on demand — mirrors getGoogleShoppingConnection's shape. */
export async function getSearchConsoleConnection(): Promise<SearchConsoleConnection> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("search_console_settings")
    .select("site_url, access_token, access_token_expires_at")
    .eq("environment", "production")
    .single();

  if (error || !data || !data.site_url) {
    throw new Error("Search Console não configurado. Defina a URL do site em Configurações.");
  }

  const expiresAt = data.access_token_expires_at ? new Date(data.access_token_expires_at).getTime() : 0;
  if (data.access_token && expiresAt > Date.now() + 60_000) {
    return { accessToken: data.access_token, siteUrl: data.site_url };
  }

  const { accessToken, expiresAt: newExpiresAt } = await mintAccessToken();
  await supabase
    .from("search_console_settings")
    .update({ access_token: accessToken, access_token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq("environment", "production");

  return { accessToken, siteUrl: data.site_url };
}

export async function getSiteUrl(): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("search_console_settings")
    .select("site_url")
    .eq("environment", "production")
    .single();
  return data?.site_url || "https://vertexrentalcar.com/";
}

export async function saveSiteUrl(siteUrl: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("search_console_settings")
    .update({ site_url: siteUrl, updated_at: new Date().toISOString() })
    .eq("environment", "production");
}
