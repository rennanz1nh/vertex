export type SyncStatus = "success" | "partial" | "error";

/**
 * A run only counts as "success" if every product Google was asked to accept came back
 * ok — synced < total (Google rejected at least one item) must never be reported as
 * success, since callers otherwise can't tell a real sync from one where nothing landed.
 */
export function computeSyncStatus(synced: number, total: number): SyncStatus {
  if (total === 0 || synced === total) return "success";
  if (synced === 0) return "error";
  return "partial";
}
