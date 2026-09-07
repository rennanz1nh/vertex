import { getGoogleShoppingConnection } from "@/lib/google-shopping-auth";

// Merchant Center features beyond the product feed itself: account-wide issues (as
// opposed to per-product issues, already covered by fetchProductStatuses in
// google-shopping-feed.ts), an aggregate/rollup view of product status counts, and
// merchant promotions. All three reuse the same service-account connection Google
// Shopping already has — no new credentials or OAuth scope needed.

const API_BASE = "https://merchantapi.googleapis.com";

export type AccountIssue = {
  name: string;
  title: string;
  severity: string;
  detail: string;
  documentationUri: string | null;
  impactedDestinations: string[];
};

type RawAccountIssue = {
  name?: string;
  title?: string;
  severity?: string;
  detail?: string;
  documentationUri?: string;
  impactedDestinations?: { reportingContext?: string }[];
};

/** Account-level issues (suspensions, policy violations, misrepresentation flags, etc.)
 *  — distinct from per-product issues, which come from products.list instead (see
 *  fetchProductStatuses in google-shopping-feed.ts). This is the one place these
 *  account-wide problems actually surface. */
export async function fetchAccountIssues(): Promise<AccountIssue[]> {
  const { accessToken, merchantId } = await getGoogleShoppingConnection();
  const issues: AccountIssue[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${API_BASE}/accounts/v1/accounts/${merchantId}/issues`);
    url.searchParams.set("languageCode", "en");
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Falha ao buscar problemas da conta (${res.status}): ${await res.text()}`);
    const body = await res.json();

    for (const raw of (body.accountIssues ?? []) as RawAccountIssue[]) {
      issues.push({
        name: raw.name ?? "",
        title: raw.title ?? "Problema sem título",
        severity: raw.severity ?? "unknown",
        detail: raw.detail ?? "",
        documentationUri: raw.documentationUri ?? null,
        impactedDestinations: (raw.impactedDestinations ?? []).map((d) => d.reportingContext).filter((v): v is string => !!v),
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return issues;
}

export type AggregateProductStatusIssue = {
  severity: string;
  attribute: string | null;
  documentationUri: string | null;
  productCount: number;
};

export type AggregateProductStatus = {
  reportingContext: string;
  country: string;
  itemLevelIssues: AggregateProductStatusIssue[];
};

type RawAggregateProductStatus = {
  reportingContext?: string;
  country?: string;
  itemLevelIssues?: { severity?: string; attribute?: string; documentationUri?: string; productCount?: string | number }[];
};

/** Rollup view of product status counts per (reportingContext, country) — the "how many
 *  products are actually blocked and why" summary that products.list alone doesn't give
 *  you without paging through and counting every item yourself. Lives under a separate
 *  `issueresolution` service root, not `accounts`. */
export async function fetchAggregateProductStatuses(): Promise<AggregateProductStatus[]> {
  const { accessToken, merchantId } = await getGoogleShoppingConnection();
  const statuses: AggregateProductStatus[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${API_BASE}/issueresolution/v1/accounts/${merchantId}/aggregateProductStatuses`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Falha ao buscar o resumo de status dos produtos (${res.status}): ${await res.text()}`);
    const body = await res.json();

    for (const raw of (body.aggregateProductStatuses ?? []) as RawAggregateProductStatus[]) {
      statuses.push({
        reportingContext: raw.reportingContext ?? "unknown",
        country: raw.country ?? "—",
        itemLevelIssues: (raw.itemLevelIssues ?? []).map((i) => ({
          severity: i.severity ?? "unknown",
          attribute: i.attribute ?? null,
          documentationUri: i.documentationUri ?? null,
          productCount: Number(i.productCount ?? 0),
        })),
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return statuses;
}

export type Promotion = {
  promotionId: string;
  title: string | null;
  redemptionChannel: string[];
  targetCountry: string | null;
  startTime: string | null;
  endTime: string | null;
  raw: unknown;
};

type RawPromotion = {
  promotionId?: string;
  attributes?: {
    longTitle?: string;
    promotionEffectiveTimePeriod?: { startTime?: string; endTime?: string };
  };
  redemptionChannel?: string[];
  targetCountry?: string;
};

/**
 * Lists existing merchant promotions. Read-only for now — this is the least-verified
 * piece of this file (Google's create/insert schema for promotions.insert wasn't found
 * as a confirmed raw JSON reference during research, only inferred from client-library
 * docs), so creating a promotion from here isn't implemented yet to avoid the same
 * guessing problem eBay's ad_report_task date format caused before. `raw` is kept on
 * each result so the actual shape can be inspected in the browser once real promotions
 * exist on this account, before building a create flow on top of it.
 */
export async function fetchPromotions(): Promise<Promotion[]> {
  const { accessToken, merchantId } = await getGoogleShoppingConnection();
  const promotions: Promotion[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${API_BASE}/promotions/v1/accounts/${merchantId}/promotions`);
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const text = await res.text();
      // Confirmed against this account: 403 PERMISSION_DENIED_NOT_ALLOWLISTED_TO_USE_PROMOTION_PROGRAM
      // means the Merchant Center account itself was never enrolled in Google's Promotions
      // program (an opt-in step in Merchant Center, unrelated to our API credentials/scope) —
      // surfaced as a plain message instead of the raw error JSON.
      if (res.status === 403 && text.includes("NOT_ALLOWLISTED_TO_USE_PROMOTION_PROGRAM")) {
        throw new Error(
          "O programa de Promoções do Google não está habilitado para esta conta do Merchant Center. " +
            "É preciso ativá-lo em Merchant Center → Growth → Promoções antes que ele apareça aqui."
        );
      }
      throw new Error(`Falha ao buscar promoções (${res.status}): ${text}`);
    }
    const body = await res.json();

    for (const raw of (body.promotions ?? []) as RawPromotion[]) {
      promotions.push({
        promotionId: raw.promotionId ?? "—",
        title: raw.attributes?.longTitle ?? null,
        redemptionChannel: raw.redemptionChannel ?? [],
        targetCountry: raw.targetCountry ?? null,
        startTime: raw.attributes?.promotionEffectiveTimePeriod?.startTime ?? null,
        endTime: raw.attributes?.promotionEffectiveTimePeriod?.endTime ?? null,
        raw,
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return promotions;
}
