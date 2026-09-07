import type { SocialPlatform } from "../types";
import type { SocialPlatformAdapter } from "./types";
import { instagramAdapter } from "./instagram-adapter";
import { tiktokAdapter } from "./tiktok-adapter";

/**
 * Maps a platform to its publish-capable adapter. Facebook/YouTube/Pinterest
 * are valid SocialPlatform values (the read-only HUB already connects them)
 * but have no publishing adapter yet — getPlatformAdapter returns null for
 * those rather than throwing, so callers can surface a clear "not
 * implemented yet" error instead of a stack trace.
 */
const ADAPTERS: Partial<Record<SocialPlatform, SocialPlatformAdapter>> = {
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
};

export function getPlatformAdapter(platform: SocialPlatform): SocialPlatformAdapter | null {
  return ADAPTERS[platform] ?? null;
}

export function isPublishablePlatform(platform: SocialPlatform): boolean {
  return platform in ADAPTERS;
}
