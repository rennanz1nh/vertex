import { createClient } from "@supabase/supabase-js";
import { createSign } from "node:crypto";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type ServiceAccount = { client_email: string; project_id?: string; private_key: string };

/** Same GCP service account as Google Shopping and Search Console — only the requested
 *  OAuth scope changes per use. No new secret to configure. */
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
  return { client_email: parsed.client_email, project_id: parsed.project_id, private_key: parsed.private_key };
}

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input)).toString("base64url");
}

export function getServiceAccountEmail(): string {
  return loadServiceAccount().client_email;
}

/** The GCP project ID — read from the key's own `project_id` field when present, falling
 *  back to parsing it out of the service account email (name@PROJECT_ID.iam.gserviceaccount.com),
 *  which is always accurate since that's how Google issues these emails. */
export function getProjectId(): string {
  const { client_email, project_id } = loadServiceAccount();
  if (project_id) return project_id;
  const match = client_email.match(/@([^.]+)\.iam\.gserviceaccount\.com$/);
  if (!match) throw new Error("Não foi possível determinar o project_id a partir do e-mail da service account.");
  return match[1];
}

async function mintAccessToken(scope: string): Promise<{ accessToken: string; expiresAt: string }> {
  const { client_email, private_key } = loadServiceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Falha ao gerar token do Google (service account): ${body}`);
  }
  const data = await res.json();
  return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString() };
}

/**
 * Uncached scoped token for the lower-traffic dashboard reads (IAM policy, Billing,
 * BigQuery) — each is a single on-demand fetch when an admin opens that tab, not a
 * background poll, so the DB round-trip a persistent cache would save isn't worth the
 * extra column-per-scope schema (unlike getAnalyticsAccessToken below, which existed
 * before this and stays cached since GA4 status is already checked more frequently).
 */
export async function mintScopedAccessToken(scope: string): Promise<string> {
  const { accessToken } = await mintAccessToken(scope);
  return accessToken;
}

/** Read-only GCP-wide token, cached in google_cloud_settings — used for the Analytics
 *  Admin API (BigQuery link check). Scope is broad-ish (analytics.readonly) but this is a
 *  server-only credential, never exposed to the browser. */
export async function getAnalyticsAccessToken(): Promise<string> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("google_cloud_settings")
    .select("access_token, access_token_expires_at")
    .eq("environment", "production")
    .single();

  const expiresAt = data?.access_token_expires_at ? new Date(data.access_token_expires_at).getTime() : 0;
  if (data?.access_token && expiresAt > Date.now() + 60_000) {
    return data.access_token;
  }

  const { accessToken, expiresAt: newExpiresAt } = await mintAccessToken("https://www.googleapis.com/auth/analytics.readonly");
  await supabase
    .from("google_cloud_settings")
    .update({ access_token: accessToken, access_token_expires_at: newExpiresAt, updated_at: new Date().toISOString() })
    .eq("environment", "production");
  return accessToken;
}

export async function getGa4PropertyId(): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("google_cloud_settings")
    .select("ga4_property_id")
    .eq("environment", "production")
    .single();
  return data?.ga4_property_id || null;
}

export async function saveGa4PropertyId(propertyId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("google_cloud_settings")
    .update({ ga4_property_id: propertyId, updated_at: new Date().toISOString() })
    .eq("environment", "production");
}

export async function getBillingAccountId(): Promise<string | null> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("google_cloud_settings")
    .select("billing_account_id")
    .eq("environment", "production")
    .single();
  return data?.billing_account_id || null;
}

export async function saveBillingAccountId(billingAccountId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("google_cloud_settings")
    .update({ billing_account_id: billingAccountId, updated_at: new Date().toISOString() })
    .eq("environment", "production");
}
