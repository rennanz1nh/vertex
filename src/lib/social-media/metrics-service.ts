import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAuditEvent } from "@/lib/audit-log";
import { getPlatformAdapter } from "./platforms/registry";
import type { PlatformAccount, PostMetricsResult } from "./platforms/types";
import type { SocialPlatform } from "./types";

/**
 * Spec section 16: sync more often right after publishing, when engagement
 * moves fastest, then taper off. Each stage's offset is measured from
 * published_at (an absolute checkpoint), not from the previous sync — so a
 * missed cron tick doesn't push every later checkpoint back too.
 */
const SYNC_STAGES: { stage: string; offsetMinutesFromPublish: number }[] = [
  { stage: "10m", offsetMinutesFromPublish: 10 },
  { stage: "1h", offsetMinutesFromPublish: 60 },
  { stage: "6h", offsetMinutesFromPublish: 6 * 60 },
  { stage: "24h", offsetMinutesFromPublish: 24 * 60 },
  { stage: "48h", offsetMinutesFromPublish: 48 * 60 },
  { stage: "7d", offsetMinutesFromPublish: 7 * 24 * 60 },
];
const WEEKLY_MINUTES = 7 * 24 * 60;
const CLAIM_WINDOW_MS = 5 * 60 * 1000;

/** Called right after a publish succeeds — schedules the first sync at published_at+10m. */
export async function createInitialMetricsRow(publicationId: string, platform: SocialPlatform, publishedAt: string): Promise<void> {
  const nextSyncAt = new Date(new Date(publishedAt).getTime() + SYNC_STAGES[0].offsetMinutesFromPublish * 60000).toISOString();
  const { error } = await supabaseAdmin
    .from("social_post_metrics")
    .upsert({ publication_id: publicationId, platform, sync_stage: "initial", next_sync_at: nextSyncAt }, { onConflict: "publication_id" });
  if (error) throw new Error(error.message);
}

export function nextStageAfter(currentStage: string, publishedAtMs: number, now: Date): { stage: string; nextSyncAt: string } {
  if (currentStage === "initial") {
    const first = SYNC_STAGES[0];
    return { stage: first.stage, nextSyncAt: new Date(publishedAtMs + first.offsetMinutesFromPublish * 60000).toISOString() };
  }
  const idx = SYNC_STAGES.findIndex((s) => s.stage === currentStage);
  if (idx >= 0 && idx < SYNC_STAGES.length - 1) {
    const next = SYNC_STAGES[idx + 1];
    return { stage: next.stage, nextSyncAt: new Date(publishedAtMs + next.offsetMinutesFromPublish * 60000).toISOString() };
  }
  // Past the last defined checkpoint (or already "weekly") — keep syncing every 7 days from now.
  return { stage: "weekly", nextSyncAt: new Date(now.getTime() + WEEKLY_MINUTES * 60000).toISOString() };
}

/** Sum of whatever interaction counts the platform actually returned — never divides by a possibly-null/zero denominator, never fabricates a value the platform didn't give us. */
export function computeEngagement(m: PostMetricsResult): number | null {
  const parts = [m.likes, m.comments, m.shares, m.saves];
  if (parts.every((v) => v === null)) return null;
  return parts.reduce((sum: number, v) => sum + (v ?? 0), 0);
}

export interface DueMetricsRow {
  id: string;
  publication_id: string;
  platform: SocialPlatform;
  sync_stage: string;
}

export async function listDueMetricsSyncs(limit = 10): Promise<DueMetricsRow[]> {
  const { data, error } = await supabaseAdmin
    .from("social_post_metrics")
    .select("id, publication_id, platform, sync_stage")
    .lte("next_sync_at", new Date().toISOString())
    .order("next_sync_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as DueMetricsRow[];
}

export interface SyncMetricsResult {
  publicationId: string;
  outcome: "synced" | "skipped" | "failed";
  reason?: string;
}

/** Syncs one publication's metrics: fetch from the platform, update the latest snapshot, append to history, advance the backoff schedule. */
export async function syncPublicationMetrics(row: DueMetricsRow): Promise<SyncMetricsResult> {
  // Optimistic claim: push next_sync_at into a short "in progress" window before the slow
  // platform call, so an overlapping cron run can't double-sync (and double-insert into
  // history) the same row. Mirrors the atomic claim in publish-service.ts.
  const claimedUntil = new Date(Date.now() + CLAIM_WINDOW_MS).toISOString();
  const { data: claimedRows, error: claimError } = await supabaseAdmin
    .from("social_post_metrics")
    .update({ next_sync_at: claimedUntil })
    .eq("id", row.id)
    .lte("next_sync_at", new Date().toISOString())
    .select("id");
  if (claimError) throw new Error(claimError.message);
  if (!claimedRows || claimedRows.length === 0) {
    return { publicationId: row.publication_id, outcome: "skipped", reason: "Already claimed by another run" };
  }

  const { data: publication, error: pubError } = await supabaseAdmin
    .from("social_publications")
    .select("id, platform, account_id, platform_post_id, published_at, status")
    .eq("id", row.publication_id)
    .maybeSingle();
  if (pubError) throw new Error(pubError.message);
  if (!publication || publication.status !== "PUBLISHED" || !publication.platform_post_id || !publication.published_at) {
    return { publicationId: row.publication_id, outcome: "skipped", reason: "Publication is not in a published state anymore" };
  }

  const adapter = getPlatformAdapter(publication.platform);
  if (!adapter) return { publicationId: row.publication_id, outcome: "skipped", reason: `No adapter for platform '${publication.platform}'` };

  try {
    const { data: accountRow, error: accountError } = await supabaseAdmin
      .from("social_media_accounts")
      .select("id, platform, account_id, access_token, refresh_token, expires_at")
      .eq("id", publication.account_id)
      .maybeSingle();
    if (accountError) throw new Error(accountError.message);
    if (!accountRow) throw new Error("Account not found");

    const account: PlatformAccount = {
      id: accountRow.id,
      platform: accountRow.platform,
      account_id: accountRow.account_id,
      access_token: accountRow.access_token,
      refresh_token: accountRow.refresh_token,
      expires_at: accountRow.expires_at,
    };

    const [metrics, accountInfo] = await Promise.all([
      adapter.getMetrics(account, publication.platform_post_id),
      adapter.getAccountInfo(account).catch(() => null),
    ]);

    const { stage: nextStage, nextSyncAt } = nextStageAfter(row.sync_stage, new Date(publication.published_at).getTime(), new Date());
    const engagement = computeEngagement(metrics);
    const now = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin.from("social_post_metrics").upsert(
      {
        publication_id: row.publication_id,
        platform: publication.platform,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        saves: metrics.saves,
        reach: metrics.reach,
        engagement,
        watch_time_seconds: metrics.watchTimeSeconds,
        followers_at_snapshot: accountInfo?.followerCount ?? null,
        sync_stage: nextStage,
        next_sync_at: nextSyncAt,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: "publication_id" }
    );
    if (upsertError) throw new Error(upsertError.message);

    const { error: historyError } = await supabaseAdmin.from("social_post_metrics_history").insert({
      publication_id: row.publication_id,
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      saves: metrics.saves,
      reach: metrics.reach,
      engagement,
      watch_time_seconds: metrics.watchTimeSeconds,
    });
    if (historyError) throw new Error(historyError.message);

    return { publicationId: row.publication_id, outcome: "synced" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error while syncing metrics";
    // Leave the claimed (near-future) next_sync_at in place rather than retrying immediately —
    // a transient platform error will get picked up again on the next cron tick either way.
    await logAuditEvent({
      tableName: "social_post_metrics",
      recordId: row.publication_id,
      action: "metrics_sync_failed",
      source: "cron",
      newValues: { error: message },
    });
    return { publicationId: row.publication_id, outcome: "failed", reason: message };
  }
}

export interface PublicationMetricsSnapshot {
  publication_id: string;
  platform: SocialPlatform;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  engagement: number | null;
  watch_time_seconds: number | null;
  followers_at_snapshot: number | null;
  sync_stage: string;
  last_synced_at: string | null;
  next_sync_at: string | null;
}

export async function getPublicationMetrics(publicationId: string): Promise<PublicationMetricsSnapshot | null> {
  const { data, error } = await supabaseAdmin
    .from("social_post_metrics")
    .select(
      "publication_id, platform, views, likes, comments, shares, saves, reach, engagement, watch_time_seconds, followers_at_snapshot, sync_stage, last_synced_at, next_sync_at"
    )
    .eq("publication_id", publicationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as PublicationMetricsSnapshot | null;
}

export interface MetricsHistoryPoint {
  recorded_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  engagement: number | null;
  watch_time_seconds: number | null;
}

export async function getMetricsHistory(publicationId: string, limit = 100): Promise<MetricsHistoryPoint[]> {
  const { data, error } = await supabaseAdmin
    .from("social_post_metrics_history")
    .select("recorded_at, views, likes, comments, shares, saves, reach, engagement, watch_time_seconds")
    .eq("publication_id", publicationId)
    .order("recorded_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as MetricsHistoryPoint[];
}

export interface PerformanceOverviewRow {
  publication_id: string;
  platform: SocialPlatform;
  published_at: string | null;
  url: string | null;
  video_filename: string | null;
  metrics: {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    reach: number | null;
    engagement: number | null;
    watch_time_seconds: number | null;
    last_synced_at: string | null;
  } | null;
}

/**
 * Published videos + their latest metrics, ranked by engagement. Shared by
 * the analyze_content_performance MCP tool and the Hub's Analytics page —
 * one query, two callers, rather than the same join logic living twice.
 */
export async function getPerformanceOverview(params: { platform?: SocialPlatform; limit?: number } = {}): Promise<PerformanceOverviewRow[]> {
  let pubQuery = supabaseAdmin
    .from("social_publications")
    .select("id, video_id, platform, published_at, permalink")
    .eq("status", "PUBLISHED")
    .order("published_at", { ascending: false })
    .limit(params.limit ?? 20);
  if (params.platform) pubQuery = pubQuery.eq("platform", params.platform);
  const { data: publications, error: pubError } = await pubQuery;
  if (pubError) throw new Error(pubError.message);
  if (!publications || publications.length === 0) return [];

  const publicationIds = publications.map((p) => p.id);
  const videoIds = [...new Set(publications.map((p) => p.video_id))];

  const [{ data: metricsRows, error: metricsError }, { data: videoRows, error: videoError }] = await Promise.all([
    supabaseAdmin
      .from("social_post_metrics")
      .select("publication_id, views, likes, comments, shares, saves, reach, engagement, watch_time_seconds, last_synced_at")
      .in("publication_id", publicationIds),
    supabaseAdmin.from("social_videos").select("id, filename").in("id", videoIds),
  ]);
  if (metricsError) throw new Error(metricsError.message);
  if (videoError) throw new Error(videoError.message);

  const metricsByPublication = new Map((metricsRows ?? []).map((m) => [m.publication_id as string, m]));
  const videoById = new Map((videoRows ?? []).map((v) => [v.id as string, v]));

  const merged: PerformanceOverviewRow[] = publications.map((p) => ({
    publication_id: p.id,
    platform: p.platform,
    published_at: p.published_at,
    url: p.permalink,
    video_filename: videoById.get(p.video_id)?.filename ?? null,
    metrics: metricsByPublication.get(p.id) ?? null,
  }));

  merged.sort((a, b) => (b.metrics?.engagement ?? -1) - (a.metrics?.engagement ?? -1));
  return merged;
}
