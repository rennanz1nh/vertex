import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

export type LogSource = "ebay" | "amazon" | "google-shopping";

export type UnifiedLogEntry = {
  id: string;
  source: LogSource;
  created_at: string;
  trigger: string;
  mode: string;
  status: string;
  total: number | null;
  updated: number | null;
  error: string | null;
};

type SourceConfig = { source: LogSource; table: string; updatedColumn: string };

const SOURCES: SourceConfig[] = [
  { source: "ebay", table: "ebay_price_automation_logs", updatedColumn: "updated" },
  { source: "amazon", table: "amazon_price_automation_logs", updatedColumn: "updated" },
  { source: "google-shopping", table: "google_shopping_sync_logs", updatedColumn: "synced" },
];

/**
 * Merges the three separate per-integration log tables into one timeline — this is the
 * in-house equivalent of GCP Cloud Logging: same "who ran, when, what happened" shape,
 * without needing to wire a Cloud Logging sink. Tables that don't exist yet (e.g. Amazon's,
 * whose migration was never applied to this project) degrade to a per-source `unavailable`
 * flag instead of failing the whole request.
 */
export async function fetchUnifiedLogs(limit = 50): Promise<{ entries: UnifiedLogEntry[]; unavailable: LogSource[] }> {
  const supabase = getSupabase();
  const unavailable: LogSource[] = [];

  const results = await Promise.all(
    SOURCES.map(async ({ source, table, updatedColumn }) => {
      // Dynamic table names/select lists aren't representable in the generated Supabase
      // types, so this queries loosely (any) and maps by hand instead of fighting the typed client.
      const { data, error } = await (supabase.from(table) as any)
        .select("id, created_at, trigger, mode, status, total, error, " + updatedColumn)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        unavailable.push(source);
        return [];
      }

      return ((data ?? []) as Record<string, unknown>[]).map(
        (row): UnifiedLogEntry => ({
          id: row.id as string,
          source,
          created_at: row.created_at as string,
          trigger: row.trigger as string,
          mode: row.mode as string,
          status: row.status as string,
          total: (row.total as number | null) ?? null,
          updated: (row[updatedColumn] as number | null) ?? null,
          error: (row.error as string | null) ?? null,
        })
      );
    })
  );

  const entries = results
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return { entries, unavailable };
}
