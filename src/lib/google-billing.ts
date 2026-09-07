import { getProjectId, getBillingAccountId, saveBillingAccountId, mintScopedAccessToken } from "@/lib/google-cloud-auth";

// Cloud Billing + Billing Budgets APIs. Real-time "amount spent so far this month" is NOT
// exposed by a simple REST call without a BigQuery billing export configured (a separate,
// extra piece of GCP setup) — so this deliberately only surfaces account status and
// configured budgets/thresholds, not a live running total. If that's ever needed, it would
// be a natural extension of the BigQuery integration below (google-bigquery.ts), not this
// file, once/if a billing export is set up.
const BILLING_BASE = "https://cloudbilling.googleapis.com/v1";
const BUDGETS_BASE = "https://billingbudgets.googleapis.com/v1";
const BILLING_SCOPE = "https://www.googleapis.com/auth/cloud-billing.readonly";

export type BillingInfo = { billingAccountName: string | null; billingEnabled: boolean };

/** Which billing account (if any) is linked to this project, and whether billing is
 *  active — the one thing here that needs zero manual setup beyond enabling the API,
 *  since the project→billing-account link is already established outside this app. */
export async function getProjectBillingInfo(): Promise<BillingInfo> {
  const projectId = getProjectId();
  const accessToken = await mintScopedAccessToken(BILLING_SCOPE);

  const res = await fetch(`${BILLING_BASE}/projects/${projectId}/billingInfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Falha ao buscar informações de faturamento (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = await res.json();
  return {
    billingAccountName: data.billingAccountName ?? null,
    billingEnabled: !!data.billingEnabled,
  };
}

export type Budget = {
  name: string;
  displayName: string;
  amount: number | null;
  currency: string | null;
  thresholdPercents: number[];
};

type RawBudget = {
  name?: string;
  displayName?: string;
  amount?: { specifiedAmount?: { units?: string; currencyCode?: string }; lastPeriodAmount?: unknown };
  thresholdRules?: { thresholdPercent?: number }[];
};

/**
 * Configured budgets (name, amount, alert thresholds) on the linked billing account —
 * requires billingAccountName from getProjectBillingInfo() first (cached in
 * google_cloud_settings once looked up, since it doesn't change).
 */
export async function listBudgets(): Promise<Budget[]> {
  let billingAccountId = await getBillingAccountId();
  if (!billingAccountId) {
    const info = await getProjectBillingInfo();
    if (!info.billingAccountName) {
      throw new Error("Este projeto não tem uma conta de faturamento vinculada.");
    }
    billingAccountId = info.billingAccountName.replace(/^billingAccounts\//, "");
    await saveBillingAccountId(billingAccountId);
  }

  const accessToken = await mintScopedAccessToken(BILLING_SCOPE);
  const budgets: Budget[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${BUDGETS_BASE}/billingAccounts/${billingAccountId}/budgets`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha ao buscar orçamentos (${res.status}): ${text.slice(0, 500)}`);
    }
    const data = await res.json();
    for (const raw of (data.budgets ?? []) as RawBudget[]) {
      const units = raw.amount?.specifiedAmount?.units;
      budgets.push({
        name: raw.name ?? "",
        displayName: raw.displayName ?? "Orçamento sem nome",
        amount: units ? Number(units) : null,
        currency: raw.amount?.specifiedAmount?.currencyCode ?? null,
        thresholdPercents: (raw.thresholdRules ?? []).map((t) => t.thresholdPercent ?? 0).filter((v) => v > 0),
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return budgets;
}
