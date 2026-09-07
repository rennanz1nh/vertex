import { getGa4PropertyId, mintScopedAccessToken } from "@/lib/google-cloud-auth";
import { listBigQueryLinks } from "@/lib/google-analytics-admin-api";

// Actually queries the GA4 daily-export dataset in BigQuery — distinct from
// google-analytics-admin-api.ts's listBigQueryLinks(), which only confirms the export
// link exists. The export lands in a project the user chose while linking GA4 to
// BigQuery (not necessarily this app's own GCP project), so the destination project
// number comes from the link resource itself (BigQueryLink.project, "projects/{number}"),
// not from getProjectId(). Every BigQuery query has a real (small) cost past the 1TB/month
// free tier — see google-billing.ts for spend visibility before relying on this heavily.
const BIGQUERY_BASE = "https://bigquery.googleapis.com/bigquery/v2";
const BIGQUERY_SCOPE = "https://www.googleapis.com/auth/bigquery.readonly";

export type PurchaseSummaryRow = { date: string; purchases: number; revenue: number };

/**
 * Daily purchase count + revenue straight from the raw GA4 export event tables
 * (events_* / events_intraday_*), for the last N days. This is real GA4 event data, not
 * available through the GA4 UI's standard reports without a custom exploration — the
 * concrete "worth having BigQuery access for" payoff. Table/column names follow Google's
 * documented GA4 BigQuery export schema (event_name, event_date, ecommerce.purchase_revenue).
 */
export async function queryDailyPurchases(days: number): Promise<PurchaseSummaryRow[]> {
  const propertyId = await getGa4PropertyId();
  if (!propertyId) {
    throw new Error("GA4 Property ID não configurado. Defina o Property ID numérico nas configurações.");
  }
  const links = await listBigQueryLinks();
  const link = links[0];
  if (!link) {
    throw new Error("Nenhum link do GA4 com o BigQuery configurado — configure-o na aba de Tráfego (GA4) primeiro.");
  }
  const bqProjectNumber = link.project.replace(/^projects\//, "");
  const dataset = `analytics_${propertyId}`;

  const accessToken = await mintScopedAccessToken(BIGQUERY_SCOPE);

  // events_* covers finalized days; events_intraday_* covers today (finalized only once
  // a day later) — UNION ALL so "last N days" doesn't silently miss today's partial data.
  const query = `
    SELECT
      PARSE_DATE('%Y%m%d', event_date) AS date,
      COUNTIF(event_name = 'purchase') AS purchases,
      SUM(IF(event_name = 'purchase', ecommerce.purchase_revenue, 0)) AS revenue
    FROM \`${bqProjectNumber}.${dataset}.events_*\`
    WHERE _TABLE_SUFFIX BETWEEN FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL ${days} DAY)) AND FORMAT_DATE('%Y%m%d', CURRENT_DATE())
    GROUP BY date
    ORDER BY date
  `.trim();

  const res = await fetch(`${BIGQUERY_BASE}/projects/${bqProjectNumber}/queries`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, useLegacySql: false }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao consultar o BigQuery (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  if (!data.jobComplete) {
    throw new Error("A consulta ao BigQuery não terminou a tempo — tente novamente.");
  }

  const rows: PurchaseSummaryRow[] = (data.rows ?? []).map((row: { f: { v: string }[] }) => ({
    date: row.f[0].v,
    purchases: Number(row.f[1].v || 0),
    revenue: Number(row.f[2].v || 0),
  }));
  return rows;
}
