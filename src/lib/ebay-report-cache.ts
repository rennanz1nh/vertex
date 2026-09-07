import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

export type CachedResult<T> = { data: T; stale: boolean; fetchedAt: string | null };

function serializeParams(params: Record<string, string> | null): string {
  if (!params) return "";
  return Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

/**
 * Every live eBay report route (campaigns, traffic, listings, seller standards,
 * customer service) wraps its "hit the eBay API and build the payload" logic with this.
 * On success, the payload is cached — so a later outage always has *something* to fall
 * back to. On failure, the last cached payload for the same reportKey+params is returned
 * instead of a blank/broken page, tagged `stale: true` with when it was actually
 * fetched. If there's no cache yet (first-ever call, or a genuinely new filter/period
 * never seen before), the original error is rethrown — there's nothing to fall back to,
 * and the caller's existing error handling (401 vs 502, "reconnect" messaging) still
 * applies exactly as before this existed.
 */
export async function withEbayCache<T>(
  reportKey: string,
  params: Record<string, string> | null,
  fetcher: () => Promise<T>
): Promise<CachedResult<T>> {
  const supabase = getSupabase();
  const paramsKey = serializeParams(params);

  try {
    const data = await fetcher();
    const fetchedAt = new Date().toISOString();
    await supabase
      .from("ebay_report_cache")
      .upsert(
        { report_key: reportKey, params: paramsKey, data: data as unknown as object, fetched_at: fetchedAt },
        { onConflict: "report_key,params" }
      );
    return { data, stale: false, fetchedAt };
  } catch (e) {
    // The live call failed and we're about to hide that behind a silent stale-cache
    // fallback below — log it first, otherwise the real eBay error (rate limit, report
    // task failure, etc.) leaves no trace anywhere and a stuck cache becomes undiagnosable.
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[ebay-report-cache] live fetch failed for ${reportKey}${paramsKey ? `?${paramsKey}` : ""}, falling back to cache: ${message}`);

    const { data: cached } = await supabase
      .from("ebay_report_cache")
      .select("data, fetched_at")
      .eq("report_key", reportKey)
      .eq("params", paramsKey)
      .maybeSingle();

    if (cached) {
      return { data: cached.data as T, stale: true, fetchedAt: cached.fetched_at };
    }
    throw e;
  }
}
