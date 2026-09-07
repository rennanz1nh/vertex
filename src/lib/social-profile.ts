import type { SocialPlatform } from "@/lib/social-platforms";

export interface SocialProfile {
  accountId: string | null;
  accountName: string | null;
  avatarUrl: string | null;
}

const EMPTY_PROFILE: SocialProfile = { accountId: null, accountName: null, avatarUrl: null };

/**
 * Best-effort "who did we just connect" lookup per platform, right after the token
 * exchange — used only to show a friendly name/avatar on the HUB's connection card.
 * Never blocks the connection itself: a failure here just leaves the card generic
 * ("Conectado") instead of aborting the whole OAuth flow over a display detail.
 */
export async function fetchSocialProfile(platform: SocialPlatform, accessToken: string): Promise<SocialProfile> {
  try {
    switch (platform) {
      case "facebook":
        return await fetchFacebookPageProfile(accessToken);
      case "instagram":
        return await fetchInstagramProfile(accessToken);
      case "tiktok":
        return await fetchTikTokProfile(accessToken);
      case "youtube":
        return await fetchYouTubeProfile(accessToken);
      case "pinterest":
        return await fetchPinterestProfile(accessToken);
      default:
        return EMPTY_PROFILE;
    }
  } catch (err) {
    console.error(`fetchSocialProfile(${platform}) failed`, err);
    return EMPTY_PROFILE;
  }
}

// The user's Facebook Page — insights/metrics are read against the Page, not the
// personal profile (Meta doesn't expose personal-profile posts via the Graph API).
async function fetchFacebookPageProfile(accessToken: string): Promise<SocialProfile> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,picture&access_token=${encodeURIComponent(accessToken)}`
  );
  const data = await res.json();
  const page = data?.data?.[0];
  if (!page) return EMPTY_PROFILE;
  return { accountId: page.id ?? null, accountName: page.name ?? null, avatarUrl: page.picture?.data?.url ?? null };
}

// Instagram Business/Creator accounts are only reachable through the Facebook Page
// they're linked to — same /me/accounts call, then the Page's instagram_business_account edge.
async function fetchInstagramProfile(accessToken: string): Promise<SocialProfile> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(accessToken)}`
  );
  const data = await res.json();
  const withIg = (data?.data ?? []).find((p: { instagram_business_account?: unknown }) => p.instagram_business_account);
  const ig = withIg?.instagram_business_account;
  if (!ig) return EMPTY_PROFILE;
  return { accountId: ig.id ?? null, accountName: ig.username ? `@${ig.username}` : null, avatarUrl: ig.profile_picture_url ?? null };
}

async function fetchTikTokProfile(accessToken: string): Promise<SocialProfile> {
  const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const user = data?.data?.user;
  if (!user) return EMPTY_PROFILE;
  return { accountId: user.open_id ?? null, accountName: user.display_name ?? null, avatarUrl: user.avatar_url ?? null };
}

async function fetchYouTubeProfile(accessToken: string): Promise<SocialProfile> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  const channel = data?.items?.[0];
  if (!channel) return EMPTY_PROFILE;
  return {
    accountId: channel.id ?? null,
    accountName: channel.snippet?.title ?? null,
    avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null,
  };
}

async function fetchPinterestProfile(accessToken: string): Promise<SocialProfile> {
  const res = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!data?.username) return EMPTY_PROFILE;
  return { accountId: data.username ?? null, accountName: `@${data.username}`, avatarUrl: data.profile_image ?? null };
}

export interface GrantedScopes {
  scopes: string[];
  canPublish: boolean;
}

// The scope name each platform's publish adapter actually needs — see
// src/lib/social-media/platforms/. Only the two platforms with a publishing
// adapter have an entry; can_publish is always false for the rest.
const PUBLISH_SCOPE: Partial<Record<SocialPlatform, string>> = {
  instagram: "instagram_content_publish",
  tiktok: "video.publish",
};

/**
 * What was actually granted, not just requested — a user can decline individual
 * permissions on the consent screen even after PLATFORM_CONFIG asked for them.
 * The token response's own `scope` field (when a platform includes one) is a first
 * signal; for Meta specifically that field is unreliable on the GET-based exchange
 * PLATFORM_CONFIG.instagram/facebook use, so this also cross-checks the authoritative
 * /me/permissions endpoint and merges in anything it reports as "granted". Best-effort
 * throughout: a failed permissions check just means can_publish stays conservatively
 * false rather than the whole OAuth connection failing over a display/capability detail.
 */
export async function fetchGrantedScopes(platform: SocialPlatform, accessToken: string, tokenResponseScope: string | null): Promise<GrantedScopes> {
  let scopes = tokenResponseScope
    ? tokenResponseScope
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (platform === "instagram" || platform === "facebook") {
    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${encodeURIComponent(accessToken)}`);
      const data = await res.json();
      const granted: string[] = (data?.data ?? [])
        .filter((p: { status?: string }) => p.status === "granted")
        .map((p: { permission: string }) => p.permission);
      if (granted.length > 0) scopes = [...new Set([...scopes, ...granted])];
    } catch (err) {
      console.error(`fetchGrantedScopes(${platform}) /me/permissions failed`, err);
    }
  }

  const publishScope = PUBLISH_SCOPE[platform];
  const canPublish = !!publishScope && scopes.includes(publishScope);
  return { scopes, canPublish };
}
