import { getAnalyticsAccessToken, getGa4PropertyId, mintScopedAccessToken } from "@/lib/google-cloud-auth";

const ANALYTICS_ADMIN_BASE = "https://analyticsadmin.googleapis.com/v1alpha";

export type BigQueryLink = {
  name: string;
  project: string;
  createTime?: string;
  dailyExportEnabled?: boolean;
  streamingExportEnabled?: boolean;
  freshDailyExportEnabled?: boolean;
};

/** Lists the BigQuery export links configured for the GA4 property (Admin > BigQuery
 *  Links in Google Analytics) — empty array means none configured yet. */
export async function listBigQueryLinks(): Promise<BigQueryLink[]> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) {
    throw new Error("GA4 Property ID não configurado. Defina o Property ID numérico nas configurações.");
  }
  const accessToken = await getAnalyticsAccessToken();
  const res = await fetch(`${ANALYTICS_ADMIN_BASE}/properties/${propertyId}/bigQueryLinks`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Analytics Admin API error (${res.status}): ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  return data.bigqueryLinks ?? [];
}

export type Ga4PropertyInfo = { name: string; displayName: string; timeZone: string; currencyCode: string };

/** Confirms the service account actually has access to the GA4 property — a friendlier
 *  signal than letting listBigQueryLinks fail with a raw 403. */
export async function getPropertyInfo(): Promise<Ga4PropertyInfo> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) {
    throw new Error("GA4 Property ID não configurado. Defina o Property ID numérico nas configurações.");
  }
  const accessToken = await getAnalyticsAccessToken();
  const res = await fetch(`${ANALYTICS_ADMIN_BASE}/properties/${propertyId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Analytics Admin API error (${res.status}): ${body.slice(0, 500)}`);
  }
  return res.json();
}

const BUTTON_LABEL_PARAM = "button_label";

/**
 * "Botões mais clicados" needs `customEvent:button_label` queryable via the Data API,
 * which GA4 only exposes once a matching custom dimension is registered (event-scoped
 * parameters aren't reportable on their own, unlike GA4's built-in dimensions). Creating
 * one needs the `analytics.edit` scope AND Editor access on the property — broader than
 * the analytics.readonly viewer token every other function here uses — so this is
 * best-effort: if the service account only has Viewer access, it fails with a clear
 * reason instead of a raw 403, and the caller falls back to asking for it to be created
 * by hand in GA4 Admin (30-second click-through, no code/deploy needed).
 */
export async function ensureButtonClickCustomDimension(): Promise<{ created: boolean; alreadyExisted: boolean }> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) {
    throw new Error("GA4 Property ID não configurado. Defina o Property ID numérico nas configurações.");
  }

  let accessToken: string;
  try {
    accessToken = await mintScopedAccessToken("https://www.googleapis.com/auth/analytics.edit");
  } catch (e) {
    throw new Error(`Não foi possível gerar um token com permissão de edição: ${e instanceof Error ? e.message : String(e)}`);
  }

  const listRes = await fetch(`${ANALYTICS_ADMIN_BASE}/properties/${propertyId}/customDimensions`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    const body = await listRes.text();
    throw new Error(
      `Sem permissão de edição na propriedade GA4 (${listRes.status}). A service account provavelmente só tem acesso de Leitor — ` +
        `crie a dimensão personalizada manualmente em GA4 Admin → Definições personalizadas → Criar dimensão personalizada ` +
        `(Escopo: Evento, Nome do parâmetro do evento: "${BUTTON_LABEL_PARAM}"). Detalhe: ${body.slice(0, 300)}`
    );
  }
  const list = await listRes.json();
  const exists = (list.customDimensions ?? []).some((d: { parameterName?: string }) => d.parameterName === BUTTON_LABEL_PARAM);
  if (exists) return { created: false, alreadyExisted: true };

  const createRes = await fetch(`${ANALYTICS_ADMIN_BASE}/properties/${propertyId}/customDimensions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      parameterName: BUTTON_LABEL_PARAM,
      displayName: "Button Label",
      description: "Texto/label do botão clicado (rastreamento de cliques do site)",
      scope: "EVENT",
    }),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Falha ao criar a dimensão personalizada (${createRes.status}): ${body.slice(0, 300)}`);
  }
  return { created: true, alreadyExisted: false };
}
