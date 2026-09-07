import type { SocialPlatform } from "../types";

export interface PlatformAccount {
  id: string;
  platform: SocialPlatform;
  account_id: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
}

export interface PublishContent {
  title: string;
  caption: string;
  hashtags: string[];
  extra: Record<string, unknown>;
}

export interface PublishSuccess {
  success: true;
  platformPostId: string;
  permalink: string | null;
  platformResponse: unknown;
}

export interface PublishFailure {
  success: false;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  platformResponse: unknown;
}

export type PublishOutcome = PublishSuccess | PublishFailure;

export interface PublishStatusResult {
  status: "processing" | "published" | "failed";
  permalink: string | null;
  errorMessage: string | null;
}

/** Every metric is nullable — a platform that doesn't expose it returns null, spec section 16 is explicit that we never fabricate a value. */
export interface PostMetricsResult {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  watchTimeSeconds: number | null;
}

export interface AccountInfoResult {
  accountId: string;
  accountName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
}

/**
 * spec section 24. connect()/disconnect() deliberately aren't part of this
 * interface: the existing Social Media HUB OAuth flow (src/lib/
 * social-platforms.ts + /api/social/[platform]/{authorize,callback,
 * disconnect}) already handles connecting an account generically across all
 * 5 platforms — this interface only covers what that flow doesn't:
 * publishing and the data a publish needs afterward.
 */
export interface SocialPlatformAdapter {
  readonly platform: SocialPlatform;
  publishVideo(account: PlatformAccount, videoUrl: string, content: PublishContent): Promise<PublishOutcome>;
  getPublishStatus(account: PlatformAccount, platformPostId: string): Promise<PublishStatusResult>;
  getMetrics(account: PlatformAccount, platformPostId: string): Promise<PostMetricsResult>;
  getAccountInfo(account: PlatformAccount): Promise<AccountInfoResult>;
}
