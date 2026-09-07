-- ============================================================================
-- Social Media MCP: video library, AI analysis, per-platform content,
-- publications (approval + scheduling folded in), and metrics.
--
-- social_media_accounts already exists (read-only Social Media HUB) and is
-- reused here as the OAuth token store for publishing too — extended below
-- with scopes/capabilities so write tools can check what an account is
-- actually authorized to do before calling out to a platform. Multi-account
-- per platform (spec section 23) is intentionally deferred: the existing
-- UNIQUE(platform) constraint and its reconnect-replaces-it upsert in
-- src/app/api/social/[platform]/callback/route.ts stay untouched here so
-- the working read-only HUB isn't put at risk while this lands.
-- ============================================================================

ALTER TABLE public.social_media_accounts
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS account_type TEXT,
  ADD COLUMN IF NOT EXISTS can_publish BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_publish_authorized BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.social_media_accounts.can_publish IS
  'Whether this account currently holds a publish-capable OAuth scope (e.g. instagram_content_publish, video.publish) — checked before any publish tool runs.';
COMMENT ON COLUMN public.social_media_accounts.auto_publish_authorized IS
  'Explicit per-account opt-in for AUTO publish mode. Defaults false: AUTO_PUBLISH_ENABLED off by default, and even when on, only applies to accounts explicitly authorized here.';

-- ----------------------------------------------------------------------------
-- social_videos: the video library. One row per uploaded video, whether it
-- arrived via the Hub's upload UI or the inbox-prefix bucket watcher.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'social-media',
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  sha256_hash TEXT NOT NULL,
  duration_seconds NUMERIC,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,
  format TEXT,
  source TEXT NOT NULL DEFAULT 'manual_upload' CHECK (source IN ('manual_upload', 'watch_folder')),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
    'NEW', 'ANALYZING', 'READY_FOR_REVIEW', 'APPROVED', 'REJECTED',
    'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED'
  )),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_videos_sha256_unique UNIQUE (sha256_hash)
);

CREATE INDEX IF NOT EXISTS social_videos_status_idx ON public.social_videos (status);

ALTER TABLE public.social_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages videos"
  ON public.social_videos
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- social_video_analysis: AI analysis results. Multiple rows allowed per
-- video (re-analysis); latest by created_at is the current analysis.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_video_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.social_videos(id) ON DELETE CASCADE,
  subject TEXT,
  people JSONB NOT NULL DEFAULT '[]',
  objects JSONB NOT NULL DEFAULT '[]',
  setting TEXT,
  context TEXT,
  style TEXT,
  target_audience TEXT,
  sentiment TEXT,
  theme TEXT,
  engagement_potential TEXT,
  suggested_titles JSONB NOT NULL DEFAULT '[]',
  keywords JSONB NOT NULL DEFAULT '[]',
  hashtag_suggestions JSONB NOT NULL DEFAULT '[]',
  model TEXT,
  raw_model_output JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_video_analysis_video_id_idx
  ON public.social_video_analysis (video_id, created_at DESC);

ALTER TABLE public.social_video_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages video analysis"
  ON public.social_video_analysis
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- social_platform_content: one row per (video, platform) — deliberately not
-- the same shape for every platform. `extra` holds fields that only make
-- sense for one platform (first_comment/location/mentions for Instagram;
-- privacy/allow_comments/allow_duet/allow_stitch for TikTok, etc.) so adding
-- a new platform's quirks never requires a schema migration.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_platform_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.social_videos(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'youtube', 'pinterest')),
  title TEXT,
  caption TEXT,
  hashtags JSONB NOT NULL DEFAULT '[]',
  extra JSONB NOT NULL DEFAULT '{}',
  generated_by TEXT NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'human', 'ai_edited')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_platform_content_video_platform_unique UNIQUE (video_id, platform)
);

ALTER TABLE public.social_platform_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages platform content"
  ON public.social_platform_content
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- social_publications: one row per (video, platform, account) publish
-- attempt. Approval and scheduling fields live here rather than in separate
-- tables — a "scheduled post" or a post "pending approval" is this same
-- entity in a particular status, not a different kind of record.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID NOT NULL REFERENCES public.social_videos(id),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'youtube', 'pinterest')),
  account_id UUID NOT NULL REFERENCES public.social_media_accounts(id),
  platform_content_id UUID REFERENCES public.social_platform_content(id),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
    'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED'
  )),
  approval_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  scheduled_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  permalink TEXT,
  error_code TEXT,
  error_message TEXT,
  platform_response JSONB,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_publications_idempotency_key_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS social_publications_status_idx ON public.social_publications (status);
CREATE INDEX IF NOT EXISTS social_publications_scheduled_at_idx ON public.social_publications (scheduled_at) WHERE scheduled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS social_publications_video_id_idx ON public.social_publications (video_id);

ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages publications"
  ON public.social_publications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- social_post_metrics: latest snapshot per publication, plus the sync
-- schedule cursor a cron poller advances through (10m/1h/6h/24h/48h/7d then
-- weekly). Every metric is nullable — a platform that doesn't expose it
-- returns null, never a fabricated value.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.social_publications(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  saves BIGINT,
  reach BIGINT,
  engagement NUMERIC,
  watch_time_seconds NUMERIC,
  followers_at_snapshot BIGINT,
  sync_stage TEXT NOT NULL DEFAULT 'initial',
  next_sync_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT social_post_metrics_publication_unique UNIQUE (publication_id)
);

CREATE INDEX IF NOT EXISTS social_post_metrics_next_sync_idx ON public.social_post_metrics (next_sync_at) WHERE next_sync_at IS NOT NULL;

ALTER TABLE public.social_post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages post metrics"
  ON public.social_post_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- social_post_metrics_history: append-only time series, one row per sync, so
-- the Hub can chart growth instead of only ever showing the latest number.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_post_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.social_publications(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  views BIGINT,
  likes BIGINT,
  comments BIGINT,
  shares BIGINT,
  saves BIGINT,
  reach BIGINT,
  engagement NUMERIC,
  watch_time_seconds NUMERIC
);

CREATE INDEX IF NOT EXISTS social_post_metrics_history_pub_idx
  ON public.social_post_metrics_history (publication_id, recorded_at DESC);

ALTER TABLE public.social_post_metrics_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages post metrics history"
  ON public.social_post_metrics_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- social_automation_settings: singleton config row (mirrors the existing
-- *_price_automation settings tables). Defaults match the spec exactly:
-- human review on, auto-publish off.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.social_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_folder_enabled BOOLEAN NOT NULL DEFAULT true,
  storage_bucket TEXT NOT NULL DEFAULT 'social-media',
  auto_analysis BOOLEAN NOT NULL DEFAULT true,
  auto_generate_captions BOOLEAN NOT NULL DEFAULT true,
  auto_generate_hashtags BOOLEAN NOT NULL DEFAULT true,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  auto_publish_enabled BOOLEAN NOT NULL DEFAULT false,
  default_account_ids JSONB NOT NULL DEFAULT '{}',
  metrics_sync_interval_minutes INTEGER NOT NULL DEFAULT 15,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.social_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages automation settings"
  ON public.social_automation_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.social_automation_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.social_automation_settings);

-- ----------------------------------------------------------------------------
-- Storage: the "watched folder" is a single private bucket with key-prefixes
-- standing in for literal folders (inbox/processing/approved/published/
-- failed/archive), since this stack has no always-on process that could
-- watch a real filesystem path. Private (not public like product-images) —
-- this holds pre-publish/unapproved video, so reads and lifecycle moves go
-- through server code (signed URLs, service role) rather than direct client
-- access.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-media', 'social-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload social media videos"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'social-media' AND auth.uid() IS NOT NULL);

CREATE POLICY "Service role manages social media storage"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'social-media')
WITH CHECK (bucket_id = 'social-media');
