export const VIDEO_STATUSES = [
  "NEW",
  "ANALYZING",
  "READY_FOR_REVIEW",
  "APPROVED",
  "REJECTED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const SOCIAL_PLATFORMS = ["instagram", "tiktok", "facebook", "youtube", "pinterest"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface VideoRecord {
  id: string;
  filename: string;
  storage_bucket: string;
  storage_path: string;
  thumbnail_path: string | null;
  sha256_hash: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  format: string | null;
  source: "manual_upload" | "watch_folder";
  status: VideoStatus;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Who/what performed a write, for audit_logs — a real Supabase user via the Hub UI, a real Supabase user via an MCP tool call, or an unattended cron job. */
export type ActionActor =
  | { source: "hub_ui"; userId: string }
  | { source: "mcp_tool"; userId: string; mcpToolName: string }
  | { source: "cron" }
  | { source: "system" };

export const PUBLICATION_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "SCHEDULED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface PublicationRecord {
  id: string;
  video_id: string;
  platform: SocialPlatform;
  account_id: string;
  platform_content_id: string | null;
  idempotency_key: string;
  status: PublicationStatus;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  auto_approved: boolean;
  rejection_reason: string | null;
  scheduled_at: string | null;
  timezone: string;
  published_at: string | null;
  platform_post_id: string | null;
  permalink: string | null;
  error_code: string | null;
  error_message: string | null;
  platform_response: unknown;
  retry_count: number;
  last_attempt_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
