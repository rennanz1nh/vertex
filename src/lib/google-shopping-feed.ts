import { createClient } from "@supabase/supabase-js";
import { getGoogleShoppingConnection } from "@/lib/google-shopping-auth";
import { getProductImage } from "@/lib/product-images";
import { getEffectivePrice } from "@/lib/pricing";
import { parsePrice } from "@/lib/utils";

const API_BASE = "https://merchantapi.googleapis.com";
// USD only — this catalog's storefront (Stripe checkout) never charges in another
// currency. feedLabel/contentLanguage are NOT hardcoded here: every product must match
// whatever the account's actual primary data source was configured with (Google rejects
// anything else), so those two are discovered via ensureDataSource and threaded through.
const CURRENCY = "USD";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

// Server-only on purpose (no NEXT_PUBLIC_ prefix): this is never read in a client
// component, and that prefix makes Next.js statically inline the value at build time
// instead of reading it from the runtime process.env — which, combined with Vercel's
// build cache, meant a value change here didn't reliably take effect even across fresh
// deployments. A plain server env var (same as GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON) is
// read fresh on every request.
function siteUrl(): string {
  const url = process.env.SITE_URL;
  if (!url) throw new Error("SITE_URL não configurado — necessário para montar link/imageLink do feed.");
  return url.replace(/\/$/, "");
}

function absoluteUrl(path: string): string {
  return /^https?:\/\//i.test(path) ? path : `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
}

export type StoreCatalogItem = {
  id: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  brand: string | null;
  imageLink: string | null;
  additionalImageLinks: string[];
  gtin: string | null;
};

/** Pulls exactly the same public-safe rows the storefront itself renders (store_visible
 *  = true), so the Google feed can never advertise a product the store doesn't sell. */
export async function fetchStoreCatalog(): Promise<StoreCatalogItem[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("store_products")
    .select(
      'id, "Produto Nome", "Informacoes dos produtos / descricao", "Valor de venda (Online)", sale_price, "Quantidade no Estoque", Marca, SKU, image_url, gallery_urls, store_visible'
    )
    .eq("store_visible", true);

  if (error) throw new Error(`Falha ao ler catálogo (store_products): ${error.message}`);

  return (data ?? [])
    .map((p): StoreCatalogItem | null => {
      const sku = p.SKU || p.id;
      if (!sku) return null;
      const { price } = getEffectivePrice(p["Valor de venda (Online)"], p.sale_price);
      const cover = p.image_url || getProductImage(p["Produto Nome"]);
      return {
        id: p.id,
        sku,
        title: p["Produto Nome"] || sku,
        description: p["Informacoes dos produtos / descricao"] || "",
        price,
        stock: parsePrice(p["Quantidade no Estoque"]),
        brand: p.Marca || null,
        imageLink: cover ? absoluteUrl(cover) : null,
        additionalImageLinks: Array.isArray(p.gallery_urls) ? p.gallery_urls.map(absoluteUrl) : [],
        gtin: null, // this catalog doesn't currently carry a validated GTIN/UPC column on store_products
      };
    })
    .filter((p): p is StoreCatalogItem => p !== null);
}

/**
 * One-time-per-GCP-project mandatory step: links the Google Cloud project behind the
 * service account to the Merchant Center account. Without this, every Merchant API call
 * fails with 401 UNAUTHENTICATED / GCP_NOT_REGISTERED, even with a valid access token and
 * Admin access granted to the service account — Google treats "added as a Merchant Center
 * user" and "registered as a developer" as two separate authorizations.
 * `developerEmail` must be a real Google account (not the service account itself, which
 * can't receive the invite/notification email) — the account this app is run for.
 */
export async function registerDeveloper(merchantId: string, accessToken: string, developerEmail: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/accounts/v1/accounts/${merchantId}/developerRegistration:registerGcp`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ developerEmail }),
    }
  );
  if (!res.ok) {
    throw new Error(`Falha ao registrar o projeto GCP na conta Merchant Center (${res.status}): ${await res.text()}`);
  }
}

type DataSource = {
  name: string;
  primaryProductDataSource?: { feedLabel?: string; contentLanguage?: string };
};

export type DiscoveredDataSource = { name: string; feedLabel: string; contentLanguage: string };

/**
 * Every Merchant Center account needs at least one primary "API" product data source
 * before productInputs.insert will accept anything. Rather than guessing at the
 * dataSources.create permissions/shape (creation of primary API data sources is
 * restricted and not fully verified here), this only *discovers* an existing one —
 * if the account has none yet, the seller needs to create it once in Merchant Center
 * (Products → Data sources → Add primary feed → API), which is a one-time setup step.
 *
 * Also returns the data source's own feedLabel/contentLanguage — every product submitted
 * through it must declare that exact same pair (Google rejects any mismatch with
 * INVALID_DATA_SOURCE_FEED_LABEL_OR_LANGUAGE_MISMATCH_ITEM), so these can't be assumed.
 */
export async function ensureDataSource(merchantId: string, accessToken: string): Promise<DiscoveredDataSource> {
  const res = await fetch(`${API_BASE}/datasources/v1/accounts/${merchantId}/dataSources`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Falha ao listar data sources do Merchant Center (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  const sources = (body.dataSources ?? []) as DataSource[];
  const primary = sources.find((s) => s.primaryProductDataSource);
  if (!primary?.primaryProductDataSource?.feedLabel || !primary.primaryProductDataSource.contentLanguage) {
    throw new Error(
      "Nenhum data source primário de produtos encontrado (ou sem feedLabel/contentLanguage configurados) " +
        "nessa conta do Merchant Center. Crie um em Merchant Center → Products → Data sources → Add primary feed → API (uma única vez)."
    );
  }
  return {
    name: primary.name,
    feedLabel: primary.primaryProductDataSource.feedLabel,
    contentLanguage: primary.primaryProductDataSource.contentLanguage,
  };
}

// NOTE: no top-level "channel" here — that field existed on the old (retired) v1beta
// ProductInput but was removed in stable v1 (online vs. local/in-store products are now
// distinguished by the data source itself, not a per-product field).
function buildProductInputBody(item: StoreCatalogItem, feedLabel: string, contentLanguage: string) {
  const hasIdentifier = !!item.gtin || !!item.brand;
  return {
    contentLanguage,
    feedLabel,
    offerId: item.sku,
    productAttributes: {
      title: item.title,
      description: item.description || item.title,
      link: `${siteUrl()}/products/${item.id}`,
      imageLink: item.imageLink ?? undefined,
      additionalImageLinks: item.additionalImageLinks.length ? item.additionalImageLinks : undefined,
      // Both are real protobuf enums in stable v1 (upper snake case), not the lowercase
      // free-form strings the old feed spec / v1beta used.
      condition: "NEW",
      availability: item.stock > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
      price: {
        amountMicros: String(Math.round(item.price * 1_000_000)),
        currencyCode: CURRENCY,
      },
      brand: item.brand ?? undefined,
      gtin: item.gtin ?? undefined,
      mpn: !item.gtin ? item.sku : undefined,
      identifierExists: hasIdentifier,
    },
  };
}

export type FeedSyncResult = { sku: string; title: string; status: "ok" | "error"; error?: string };
export type FeedSyncSummary = { total: number; synced: number; products: FeedSyncResult[] };

/**
 * Upserts products into the Merchant API feed. Per accounts.productInputs.insert docs,
 * inserting with the same (contentLanguage, offerId, dataSource) as an existing entry
 * replaces it — so this same call serves both "create" and "update".
 *
 * NOTE: this is the least-verified piece of this integration (analogous to the
 * purchasable_offer patch body in amazon-price-update.ts) — the exact `attributes`
 * field set/casing should be checked against a real response from this Merchant Center
 * account before trusting it in production, since Google's Products Data Specification
 * has category-specific required fields this generic mapping can't know about.
 */
export async function syncCatalogToGoogleShopping({
  skus,
  testMode = false,
}: { skus?: string[]; testMode?: boolean } = {}): Promise<FeedSyncSummary> {
  const { accessToken, merchantId, dataSourceName, feedLabel, contentLanguage } = await getGoogleShoppingConnection();
  const dataSource =
    dataSourceName && feedLabel && contentLanguage
      ? { name: dataSourceName, feedLabel, contentLanguage }
      : await ensureDataSource(merchantId, accessToken);

  const catalog = await fetchStoreCatalog();
  let items = skus && skus.length > 0 ? catalog.filter((c) => skus.includes(c.sku)) : catalog;
  if (testMode) items = items.slice(0, 1);

  if (items.length === 0) {
    throw new Error("Nenhum produto visível na loja para sincronizar com o Google Shopping.");
  }

  const results: FeedSyncResult[] = [];
  for (const item of items) {
    try {
      const res = await fetch(
        `${API_BASE}/products/v1/accounts/${merchantId}/productInputs:insert?dataSource=${encodeURIComponent(dataSource.name)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(buildProductInputBody(item, dataSource.feedLabel, dataSource.contentLanguage)),
        }
      );
      if (!res.ok) {
        throw new Error(await res.text());
      }
      results.push({ sku: item.sku, title: item.title, status: "ok" });
    } catch (e) {
      results.push({ sku: item.sku, title: item.title, status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { total: results.length, synced: results.filter((r) => r.status === "ok").length, products: results };
}

/** Pulls a product out of the Google Shopping feed entirely (e.g. discontinued item) —
 *  a hidden/unpublished product in the admin does NOT do this automatically; the next
 *  full sync simply stops re-submitting it, which is not the same as removing it from
 *  what's already indexed on Google. Use this explicitly when a listing must come down. */
export async function deleteFromGoogleShopping(sku: string): Promise<void> {
  const { accessToken, merchantId, dataSourceName, feedLabel, contentLanguage } = await getGoogleShoppingConnection();
  const dataSource =
    dataSourceName && feedLabel && contentLanguage
      ? { name: dataSourceName, feedLabel, contentLanguage }
      : await ensureDataSource(merchantId, accessToken);
  // Resource name format is contentLanguage~feedLabel~offerId (no channel segment — see
  // the note on buildProductInputBody about channel being removed in stable v1).
  const name = `accounts/${merchantId}/productInputs/${dataSource.contentLanguage}~${dataSource.feedLabel}~${sku}`;
  const res = await fetch(
    `${API_BASE}/products/v1/${name}?dataSource=${encodeURIComponent(dataSource.name)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(await res.text());
  }
}

export type ProductStatusIssue = { code: string; description: string; severity: string };
export type DestinationApproval = "approved" | "pending" | "disapproved";
export type ProductStatus = {
  offerId: string;
  title: string;
  issues: ProductStatusIssue[];
  approval: DestinationApproval;
};

function summarizeApproval(destinationStatuses: Array<{
  approvedCountries?: string[];
  pendingCountries?: string[];
  disapprovedCountries?: string[];
}> | undefined): DestinationApproval {
  // Confirmed against a live account: a freshly-submitted product has NO destinationStatuses
  // entries at all (not an empty-but-present array) until Google runs its first evaluation,
  // which can take a day or more — that's "pending", not "not synced" (we did submit it).
  if (!destinationStatuses || destinationStatuses.length === 0) return "pending";
  // Worst-case wins across every destination (SHOPPING_ADS, FREE_LISTINGS, ...): disapproved
  // beats pending beats approved, so a single blocked destination surfaces as a problem
  // instead of being hidden by another destination that happens to be clear.
  let best: DestinationApproval = "pending";
  for (const d of destinationStatuses) {
    if ((d.disapprovedCountries?.length ?? 0) > 0) return "disapproved";
    if ((d.pendingCountries?.length ?? 0) > 0) best = "pending";
    else if ((d.approvedCountries?.length ?? 0) > 0 && best !== "pending") best = "approved";
  }
  return best;
}

/** Diagnostics feed: which products Google actually approved vs disapproved/pending,
 *  and why — this is where most first-time Merchant Center integrations get stuck
 *  (missing GTIN, mismatched price, missing shipping/tax setup at the account level).
 *
 *  The Merchant API removed the old Content API's standalone `productstatuses` service —
 *  status now comes back embedded in each Product resource from products.list (see
 *  https://developers.google.com/merchant/api/guides/compatibility/products). Calling the
 *  old-shaped `/productStatuses` path 404s (Google's generic web 404, not a JSON API
 *  error, since the route isn't registered at all) — that was the original bug here. */
export async function fetchProductStatuses(): Promise<ProductStatus[]> {
  const { accessToken, merchantId } = await getGoogleShoppingConnection();
  const statuses: ProductStatus[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${API_BASE}/products/v1/accounts/${merchantId}/products`);
    url.searchParams.set("pageSize", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Falha ao buscar status dos produtos (${res.status}): ${await res.text()}`);
    const body = await res.json();

    for (const row of body.products ?? []) {
      const productStatus = row.productStatus ?? {};
      // Confirmed against a live account: the product's own attributes live under
      // `productAttributes` (not `attributes`), and `offerId` is a top-level field on the
      // Product resource itself — no need to parse it back out of the `name` path.
      statuses.push({
        offerId: row.offerId ?? row.name?.split("~").pop() ?? row.name,
        title: row.productAttributes?.title ?? row.offerId ?? row.name,
        issues: (productStatus.itemLevelIssues ?? []).map((i: { code?: string; description?: string; severity?: string }) => ({
          code: i.code ?? "unknown",
          description: i.description ?? "",
          severity: i.severity ?? "unknown",
        })),
        approval: summarizeApproval(productStatus.destinationStatuses),
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return statuses;
}

export type PerformanceRow = { offerId: string; title: string; clicks: number; impressions: number; ctr: number };

/** Free-listings performance (clicks/impressions) via the Reports service's SQL-like
 *  query language — there is no equivalent to eBay's traffic report cost, since organic
 *  Shopping listings are free; this is purely visibility data. `start`/`end` are
 *  YYYY-MM-DD, same convention as getReportDateRange in report-periods.ts. */
export async function fetchPerformanceReport(start: string, end: string): Promise<PerformanceRow[]> {
  const { accessToken, merchantId } = await getGoogleShoppingConnection();

  const query =
    `SELECT offer_id, title, clicks, impressions, click_through_rate FROM product_performance_view ` +
    `WHERE date BETWEEN '${start}' AND '${end}'`;

  const rows: PerformanceRow[] = [];
  let pageToken: string | undefined;

  do {
    const res = await fetch(`${API_BASE}/reports/v1/accounts/${merchantId}/reports:search`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, pageToken }),
    });
    if (!res.ok) throw new Error(`Falha ao buscar relatório de performance (${res.status}): ${await res.text()}`);
    const body = await res.json();

    for (const row of body.results ?? []) {
      const v = row.productPerformanceView;
      if (!v) continue;
      rows.push({
        offerId: v.offerId,
        title: v.title ?? v.offerId,
        clicks: Number(v.clicks ?? 0),
        impressions: Number(v.impressions ?? 0),
        ctr: Number(v.clickThroughRate ?? 0),
      });
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return rows;
}
