import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one turo_tokens row everything should read and write: the one that synced most
 * recently. A second, stale row once made the server sync pick old cookies while the
 * browser sync kept updating the other row, so every reader goes through this order.
 */
export async function activeTuroTokenRow<T = Record<string, unknown>>(
  supabase: SupabaseClient,
  columns: string,
): Promise<{ data: T | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from("turo_tokens")
    .select(columns)
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: (data as T | null) ?? null, error };
}

/** Hours after which the Turo data is too old to trust for site availability. */
export const TURO_STALE_HOURS = 6;
