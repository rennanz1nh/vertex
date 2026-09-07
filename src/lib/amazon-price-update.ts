import { createClient } from "@supabase/supabase-js";
import { getAmazonConnection } from "@/lib/amazon-token";

export type PriceUpdateResult = {
  sku: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  status: "ok" | "error";
  error?: string;
};

export type PriceUpdateSummary = {
  total: number;
  updated: number;
  products: PriceUpdateResult[];
};

export type AmazonListing = { sku: string; asin?: string; title: string; price: number };

export type GuardrailFlag = {
  reason: "pct_24h" | "batch_size";
  detail: string;
  sku?: string;
};

/** Returned instead of a PriceUpdateSummary when a run trips a mandatory guardrail
 *  (Amazon's automated pricing tool policy, in effect since June/2026) and hasn't
 *  been explicitly confirmed yet. The caller (API route) surfaces `flags` to the
 *  UI, which must show an "are you sure?" dialog and resubmit with confirmed=true. */
export type GuardrailBlockedResult = {
  blocked: true;
  flags: GuardrailFlag[];
  preview: PriceUpdateResult[];
};

const BATCH_SIZE_LIMIT = 500;
const PCT_24H_LIMIT = 20;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

/**
 * Submits a GET_MERCHANT_LISTINGS_ALL_DATA report and polls until it's ready.
 * Unlike eBay's GetMyeBaySelling (synchronous), SP-API's Reports API is async —
 * this is the same "submit → poll → download" pattern the integration plan calls
 * out for the Seller Performance report (Fase 6.2), except it also applies here,
 * to enumerating the full listing catalog for the picker.
 *
 * NOTE: report processing can take longer than a serverless function's execution
 * budget. This polls for up to ~50s before giving up with a "still processing"
 * error — a more robust design would move this off the request/response cycle
 * (Amazon supports SQS notifications on report completion), which is reasonable
 * follow-up work once this is running against a real account.
 */
export async function fetchAllActiveListings(): Promise<AmazonListing[]> {
  const { accessToken, marketplaceId } = await getAmazonConnection();
  const base = "https://sellingpartnerapi-na.amazon.com";

  const submitRes = await fetch(`${base}/reports/2021-06-30/reports`, {
    method: "POST",
    headers: { "x-amz-access-token": accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ reportType: "GET_MERCHANT_LISTINGS_ALL_DATA", marketplaceIds: [marketplaceId] }),
  });
  if (!submitRes.ok) {
    throw new Error(`Failed to request Amazon listings report (${submitRes.status})`);
  }
  const { reportId } = await submitRes.json();

  let reportDocumentId: string | null = null;
  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    const statusRes = await fetch(`${base}/reports/2021-06-30/reports/${reportId}`, {
      headers: { "x-amz-access-token": accessToken },
    });
    if (!statusRes.ok) throw new Error(`Failed to check Amazon report status (${statusRes.status})`);
    const statusBody = await statusRes.json();
    if (statusBody.processingStatus === "DONE") {
      reportDocumentId = statusBody.reportDocumentId;
      break;
    }
    if (statusBody.processingStatus === "FATAL" || statusBody.processingStatus === "CANCELLED") {
      throw new Error(`Amazon listings report failed (${statusBody.processingStatus})`);
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
  if (!reportDocumentId) {
    throw new Error("Amazon listings report is still processing — try again in a minute.");
  }

  const docRes = await fetch(`${base}/reports/2021-06-30/documents/${reportDocumentId}`, {
    headers: { "x-amz-access-token": accessToken },
  });
  if (!docRes.ok) throw new Error(`Failed to fetch Amazon report document (${docRes.status})`);
  const doc = await docRes.json();

  const fileRes = await fetch(doc.url); // pre-signed URL — no auth header needed
  const buf = Buffer.from(await fileRes.arrayBuffer());
  const text = doc.compressionAlgorithm === "GZIP"
    ? (await import("node:zlib")).gunzipSync(buf).toString("utf-8")
    : buf.toString("utf-8");

  const lines = text.split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  const skuIdx = headers.indexOf("seller-sku");
  const priceIdx = headers.indexOf("price");
  const titleIdx = headers.indexOf("item-name");
  const asinIdx = headers.indexOf("asin1");

  const listings: AmazonListing[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split("\t");
    const sku = cols[skuIdx];
    const price = parseFloat(cols[priceIdx]);
    if (sku && !isNaN(price)) {
      listings.push({ sku, price, title: cols[titleIdx] || sku, asin: cols[asinIdx] || undefined });
    }
  }
  return listings;
}

/** Cumulative % price movement per SKU over the trailing 24h, from persisted execution
 *  logs — so two runs each under 20% but adding up to more than 20% within a day still
 *  trip the guardrail, not just a single run's delta. */
async function get24hPriceBaseline(skus: string[]): Promise<Map<string, number>> {
  const supabase = getSupabase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("amazon_price_automation_logs")
    .select("products, created_at")
    .eq("status", "success")
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const baseline = new Map<string, number>();
  for (const row of data ?? []) {
    for (const p of (row.products as PriceUpdateResult[] | null) ?? []) {
      if (skus.includes(p.sku) && !baseline.has(p.sku)) {
        baseline.set(p.sku, p.oldPrice); // earliest known price within the window
      }
    }
  }
  return baseline;
}

function checkGuardrails(
  scopedItems: { sku: string; price: number }[],
  computeNewPrice: (price: number) => number,
  baseline: Map<string, number>
): GuardrailFlag[] {
  const flags: GuardrailFlag[] = [];

  if (scopedItems.length >= BATCH_SIZE_LIMIT) {
    flags.push({
      reason: "batch_size",
      detail: `Lote com ${scopedItems.length} anúncios — limite de confirmação obrigatória é ${BATCH_SIZE_LIMIT}.`,
    });
  }

  for (const item of scopedItems) {
    const base = baseline.get(item.sku) ?? item.price;
    if (base <= 0) continue;
    const newPrice = computeNewPrice(item.price);
    const pct = Math.abs(((newPrice - base) / base) * 100);
    if (pct > PCT_24H_LIMIT) {
      flags.push({
        reason: "pct_24h",
        sku: item.sku,
        detail: `${item.sku}: variação de ${pct.toFixed(1)}% em 24h (limite ${PCT_24H_LIMIT}%).`,
      });
    }
  }

  return flags;
}

/**
 * Revises the price of Amazon listings via the Listings Items API (patchListingsItem).
 * Mirrors runEbayPriceUpdate's shape (test/full/select modes, shared by manual button
 * and cron) but adds the guardrail gate eBay doesn't need: unless `confirmed` is true,
 * a run that would move any SKU's price >20% within a trailing 24h window, or that
 * touches >=500 listings at once, is blocked and returned as a GuardrailBlockedResult
 * instead of being executed.
 */
export async function runAmazonPriceUpdate({
  adjustment = -0.01,
  fixedPrice,
  testMode = true,
  itemIds,
  confirmed = false,
}: {
  adjustment?: number;
  fixedPrice?: number;
  testMode?: boolean;
  itemIds?: string[];
  confirmed?: boolean;
}): Promise<PriceUpdateSummary | GuardrailBlockedResult> {
  const { accessToken, sellerId, marketplaceId } = await getAmazonConnection();
  if (!sellerId) {
    throw new Error("Amazon seller ID not set. Reconnect the account with a valid Seller ID.");
  }
  const base = "https://sellingpartnerapi-na.amazon.com";

  let items: { sku: string; price: number; title: string }[];

  if (itemIds && itemIds.length > 0) {
    const all = await fetchAllActiveListings();
    const idSet = new Set(itemIds);
    items = all.filter((i) => idSet.has(i.sku));
  } else {
    const all = await fetchAllActiveListings();
    items = testMode ? all.slice(0, 1) : all;
  }

  if (items.length === 0) {
    throw new Error("No active listings found on Amazon");
  }

  const computeNewPrice = (price: number) =>
    fixedPrice !== undefined
      ? Math.max(0.01, parseFloat(fixedPrice.toFixed(2)))
      : Math.max(0.01, parseFloat((price + adjustment).toFixed(2)));

  if (!confirmed) {
    const baseline = await get24hPriceBaseline(items.map((i) => i.sku));
    const flags = checkGuardrails(items, computeNewPrice, baseline);
    if (flags.length > 0) {
      return {
        blocked: true,
        flags,
        preview: items.map((item) => ({
          sku: item.sku,
          title: item.title,
          oldPrice: item.price,
          newPrice: computeNewPrice(item.price),
          status: "ok" as const,
        })),
      };
    }
  }

  const results: PriceUpdateResult[] = [];
  for (const item of items) {
    const newPrice = computeNewPrice(item.price);
    try {
      // productType is required by the PATCH body and can change per listing, so it's
      // fetched fresh right before the patch rather than cached from the report.
      const getRes = await fetch(
        `${base}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(item.sku)}?marketplaceIds=${marketplaceId}&includedData=summaries`,
        { headers: { "x-amz-access-token": accessToken } }
      );
      if (!getRes.ok) throw new Error(`Could not read current listing (${getRes.status})`);
      const listing = await getRes.json();
      const productType = listing.summaries?.[0]?.productType;
      if (!productType) throw new Error("productType not found on listing");

      // NOTE: this patch body follows Amazon's documented purchasable_offer shape for
      // the Listings Items API v2021-08-01. It's the least-verified piece of this whole
      // integration — the exact attribute shape can vary by product type in practice.
      // Confirm against a real response from GET .../items/{sellerId}/{sku} for this
      // catalog's product types before trusting it against a live account.
      const patchRes = await fetch(
        `${base}/listings/2021-08-01/items/${sellerId}/${encodeURIComponent(item.sku)}?marketplaceIds=${marketplaceId}`,
        {
          method: "PATCH",
          headers: { "x-amz-access-token": accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            productType,
            patches: [
              {
                op: "replace",
                path: "/attributes/purchasable_offer",
                value: [
                  {
                    marketplace_id: marketplaceId,
                    currency: "USD",
                    our_price: [{ schedule: [{ value_with_tax: newPrice }] }],
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!patchRes.ok) {
        const errBody = await patchRes.text();
        throw new Error(errBody || `Patch failed (${patchRes.status})`);
      }
      const patchBody = await patchRes.json();
      const isOk = patchBody.status === "ACCEPTED" || patchBody.status === "VALID";

      results.push({
        sku: item.sku,
        title: item.title,
        oldPrice: item.price,
        newPrice,
        status: isOk ? "ok" : "error",
        error: isOk ? undefined : (patchBody.issues?.[0]?.message ?? "Unknown error"),
      });
    } catch (e) {
      results.push({
        sku: item.sku,
        title: item.title,
        oldPrice: item.price,
        newPrice,
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    total: results.length,
    updated: results.filter((r) => r.status === "ok").length,
    products: results,
  };
}
