import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAuditEvent } from "@/lib/audit-log";
import { getVideo } from "./video-service";
import { analyzeVideo, getLatestAnalysis } from "./video-analysis";
import { generatePlatformContent, getPlatformContent } from "./content-generation";
import { createPublication } from "./publication-service";
import { maybeAutoApproveAndPublish } from "./auto-publish-service";
import type { ActionActor, SocialPlatform, VideoRecord } from "./types";

const GENERATABLE_PLATFORMS: SocialPlatform[] = ["instagram", "tiktok"];

export interface AutomationSettings {
  id: string;
  watch_folder_enabled: boolean;
  storage_bucket: string;
  auto_analysis: boolean;
  auto_generate_captions: boolean;
  auto_generate_hashtags: boolean;
  require_approval: boolean;
  auto_publish_enabled: boolean;
  default_account_ids: Record<string, string>;
  metrics_sync_interval_minutes: number;
  updated_at: string;
  updated_by: string | null;
}

const AUTOMATION_SETTINGS_COLUMNS =
  "id, watch_folder_enabled, storage_bucket, auto_analysis, auto_generate_captions, auto_generate_hashtags, require_approval, auto_publish_enabled, default_account_ids, metrics_sync_interval_minutes, updated_at, updated_by";

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const { data, error } = await supabaseAdmin.from("social_automation_settings").select(AUTOMATION_SETTINGS_COLUMNS).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No automation settings row found — the schema migration should have seeded exactly one");
  return data as AutomationSettings;
}

export type AutomationSettingsUpdate = Partial<
  Pick<
    AutomationSettings,
    | "watch_folder_enabled"
    | "auto_analysis"
    | "auto_generate_captions"
    | "auto_generate_hashtags"
    | "require_approval"
    | "auto_publish_enabled"
    | "default_account_ids"
    | "metrics_sync_interval_minutes"
  >
>;

/** Singleton row (see the Phase 3 migration) — updates the one that already exists rather than ever inserting a second. */
export async function updateAutomationSettings(patch: AutomationSettingsUpdate, actor: ActionActor): Promise<AutomationSettings> {
  const current = await getAutomationSettings();
  const userId = actor.source === "hub_ui" || actor.source === "mcp_tool" ? actor.userId : null;

  const { data, error } = await supabaseAdmin
    .from("social_automation_settings")
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: userId })
    .eq("id", current.id)
    .select(AUTOMATION_SETTINGS_COLUMNS)
    .single();
  if (error) throw new Error(error.message);

  await logAuditEvent({
    tableName: "social_automation_settings",
    recordId: current.id,
    action: "automation_settings_updated",
    userId,
    source: actor.source,
    mcpToolName: actor.source === "mcp_tool" ? actor.mcpToolName : undefined,
    oldValues: current as unknown as Record<string, unknown>,
    newValues: patch as Record<string, unknown>,
  });

  return data as AutomationSettings;
}

export interface ProcessVideoResult {
  video: VideoRecord;
  analyzed: boolean;
  generatedPlatforms: SocialPlatform[];
  createdPublicationIds: string[];
  skippedReasons: string[];
}

/**
 * The high-level orchestrator spec asks for (process_video): analyze -> per
 * -platform content -> a PENDING_APPROVAL publication per platform that has
 * a configured account, all gated by social_automation_settings so a
 * disabled step is skipped rather than forced. Deliberately checks for
 * existing work before redoing it (existing analysis, existing content, and
 * createPublication's own built-in idempotency) so calling this twice on
 * the same video — from a retried cron tick, or a human re-running
 * process_video — doesn't re-spend Anthropic calls or duplicate rows.
 *
 * Every created publication lands in PENDING_APPROVAL first — createPublication
 * never skips that. Whether it stays there is decided right after, by
 * maybeAutoApproveAndPublish (auto-publish-service.ts): only when the global
 * auto_publish_enabled switch AND that specific account's
 * auto_publish_authorized opt-in are both on does it move further on its
 * own, through a distinct system-approval path that's never mistakable for
 * a human clicking Approve (see autoApprovePublication). Otherwise it sits
 * exactly where it landed, waiting for a human.
 */
export async function processVideoPipeline(videoId: string, actor: ActionActor): Promise<ProcessVideoResult> {
  const settings = await getAutomationSettings();
  const skippedReasons: string[] = [];

  let video = await getVideo(videoId);
  if (!video) throw new Error("Video not found");

  const existingAnalysis = await getLatestAnalysis(videoId);
  let analyzed = !!existingAnalysis;

  if (!analyzed) {
    if (!settings.auto_analysis) {
      skippedReasons.push("auto_analysis is disabled in automation settings.");
    } else if (!video.thumbnail_path) {
      skippedReasons.push("No thumbnail available yet — cannot run AI analysis.");
    } else {
      await analyzeVideo(videoId, actor);
      analyzed = true;
      video = (await getVideo(videoId)) ?? video;
    }
  }

  const generatedPlatforms: SocialPlatform[] = [];
  const createdPublicationIds: string[] = [];

  if (analyzed && (settings.auto_generate_captions || settings.auto_generate_hashtags)) {
    for (const platform of GENERATABLE_PLATFORMS) {
      try {
        const existingContent = await getPlatformContent(videoId, platform);
        if (!existingContent) {
          await generatePlatformContent(videoId, [platform], actor);
        }
        generatedPlatforms.push(platform);

        const accountId = settings.default_account_ids?.[platform];
        if (accountId) {
          const result = await createPublication({ videoId, platform, accountId, actor });
          await maybeAutoApproveAndPublish(result.publication.id);
          createdPublicationIds.push(result.publication.id);
        } else {
          skippedReasons.push(`No default account configured for ${platform} in automation settings — content was generated but no publication was created.`);
        }
      } catch (err) {
        skippedReasons.push(`${platform}: ${err instanceof Error ? err.message : "content generation failed"}`);
      }
    }
  } else if (analyzed) {
    skippedReasons.push("auto_generate_captions and auto_generate_hashtags are both disabled in automation settings.");
  }

  const finalVideo = (await getVideo(videoId)) ?? video;
  return { video: finalVideo, analyzed, generatedPlatforms, createdPublicationIds, skippedReasons };
}
