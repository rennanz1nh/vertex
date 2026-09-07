/**
 * Zernio (https://zernio.com) — a unified social media API. Zernio owns its own
 * pre-approved Meta and TikTok developer apps, so connecting an account through them
 * skips our own Meta App Review / TikTok Content Posting API audit entirely — the
 * tradeoff for the HUB (Zernio) page existing alongside the native one.
 *
 * IMPORTANT — verification status: this environment's network egress blocks zernio.com
 * directly (confirmed — 403 on the CONNECT tunnel, same as docs.zernio.com), so this
 * couldn't be tested from here. It was verified externally instead, against a real
 * account, via PowerShell — `getZernioConnectUrl` isn't confirmed yet, but profile
 * creation and `listZernioAccounts` (GET /v1/profiles) are, as of 2026-08-17; that first
 * real response is also what caught `profile.userId` being the *account* owner's id, not
 * the profile's (`profile._id` is). Everything else below is still a first draft from
 * indexed docs search snippets, not a live test call — verify before relying on it, the
 * same way instagram-adapter.ts flags its own unverified Graph API calls.
 */

const ZERNIO_API_BASE = "https://zernio.com/api/v1";

export type ZernioPlatform = "instagram" | "tiktok";

export function zernioConfigured(): boolean {
  return !!process.env.ZERNIO_API_KEY && !!process.env.ZERNIO_PROFILE_ID;
}

async function zernioFetch(path: string, init?: RequestInit) {
  const apiKey = process.env.ZERNIO_API_KEY;
  if (!apiKey) throw new Error("ZERNIO_API_KEY não configurado");

  const response = await fetch(`${ZERNIO_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => null);
  // Temporary — most of this API is still unverified against real responses (see the
  // file-level comment). Remove once every call this integration makes has been checked
  // at least once. Never logs the Authorization header/key.
  console.log(`[zernio] ${init?.method ?? "GET"} ${path} -> ${response.status}`, JSON.stringify(data)?.slice(0, 2000));
  return { ok: response.ok, status: response.status, data };
}

function requireProfileId(): string {
  const profileId = process.env.ZERNIO_PROFILE_ID;
  if (!profileId) throw new Error("ZERNIO_PROFILE_ID não configurado");
  return profileId;
}

export interface ZernioConnectUrlResult {
  authUrl: string;
}

/** GET /v1/connect/{platform}?profileId=...&redirect_url=... → { authUrl } to redirect the user's browser to. */
export async function getZernioConnectUrl(platform: ZernioPlatform, redirectUrl: string): Promise<ZernioConnectUrlResult | { error: string }> {
  const profileId = requireProfileId();
  const params = new URLSearchParams({ profileId, redirect_url: redirectUrl });
  const res = await zernioFetch(`/connect/${platform}?${params}`);
  if (!res.ok || !res.data?.authUrl) {
    return { error: res.data?.message ?? res.data?.error ?? `Zernio recusou iniciar a conexão (status ${res.status})` };
  }
  return { authUrl: res.data.authUrl };
}

export interface ZernioAccount {
  accountId: string;
  platform: ZernioPlatform;
  accountName: string | null;
  avatarUrl: string | null;
}

/**
 * GET /v1/profiles → list of profiles, confirmed for real against a live account on
 * 2026-08-17 (unlike the rest of this file). Each profile looks like:
 *   { _id, userId, name, isDefault, color, accountUsernames: string[], ... }
 * `_id` is the profile's own id (what ZERNIO_PROFILE_ID should be set to) — `userId` is
 * NOT it, it's constant across every profile on the account (the account owner's id),
 * which is exactly what this endpoint's first real response revealed.
 *
 * `accountUsernames` is only a flat list of connected usernames, with no per-account id,
 * avatar, or platform tag — so this can't disambiguate Instagram vs TikTok if a profile
 * ever has both connected. That's fine for how it's used today (the callback route
 * already knows which platform it's handling from its own URL segment; it just needs
 * confirmation that *an* account is now connected under this profile), but revisit this
 * once a profile actually has two platforms connected at once.
 */
export async function listZernioAccounts(platform: ZernioPlatform): Promise<ZernioAccount[]> {
  const profileId = requireProfileId();
  const res = await zernioFetch("/profiles");
  if (!res.ok || !Array.isArray(res.data?.profiles)) return [];

  const profile = res.data.profiles.find((p: Record<string, unknown>) => p._id === profileId);
  const usernames: unknown[] = Array.isArray(profile?.accountUsernames) ? profile.accountUsernames : [];

  return usernames
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((username) => ({ accountId: username, platform, accountName: username, avatarUrl: null }));
}

export interface ZernioPublishContent {
  caption: string;
  hashtags: string[];
}

export interface ZernioPublishResult {
  success: boolean;
  postId: string | null;
  errorMessage: string | null;
  raw: unknown;
}

/** POST /v1/posts — { content, platforms: [{platform, accountId}], publishNow: true }. */
export async function publishViaZernio(accountId: string, platform: ZernioPlatform, mediaUrl: string, content: ZernioPublishContent): Promise<ZernioPublishResult> {
  const hashtagLine = content.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  const caption = hashtagLine ? `${content.caption}\n\n${hashtagLine}` : content.caption;

  const res = await zernioFetch("/posts", {
    method: "POST",
    body: JSON.stringify({
      content: { caption, mediaUrls: [mediaUrl] },
      platforms: [{ platform, accountId }],
      publishNow: true,
    }),
  });
  if (!res.ok) {
    return { success: false, postId: null, errorMessage: res.data?.message ?? res.data?.error ?? `Zernio recusou publicar (status ${res.status})`, raw: res.data };
  }
  const postId = res.data?.id ?? res.data?.postId ?? res.data?.posts?.[0]?.id ?? null;
  return { success: true, postId: postId ? String(postId) : null, errorMessage: null, raw: res.data };
}

export interface ZernioAnalytics {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
}

/**
 * GET /v1/analytics/posts?profileId=...&accountId=...&postId=... — post-level metrics.
 * UNVERIFIED exact path — docs.zernio.com/analytics/get-analytics exists but couldn't be
 * fetched directly; field names below come from the general "likes, comments, shares,
 * saves, impressions, reach, clicks, views" list Zernio's marketing pages advertise, not
 * a confirmed response body.
 */
export async function getZernioPostAnalytics(accountId: string, postId: string): Promise<ZernioAnalytics> {
  const empty: ZernioAnalytics = { views: null, likes: null, comments: null, shares: null, saves: null, reach: null };
  const profileId = requireProfileId();
  const params = new URLSearchParams({ profileId, accountId, postId });
  const res = await zernioFetch(`/analytics/posts?${params}`);
  if (!res.ok || !res.data) return empty;
  const d = res.data;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    views: num(d.views),
    likes: num(d.likes),
    comments: num(d.comments),
    shares: num(d.shares),
    saves: num(d.saves),
    reach: num(d.reach),
  };
}

export interface ZernioAccountInsights {
  reach: number | null;
  totalInteractions: number | null;
  accountsEngaged: number | null;
  followerCount: number | null;
}

/**
 * GET /v1/accounts?profileId=... — a second, distinct "account listing" endpoint from
 * /v1/profiles, only probed here (2026-08-18) after a real 400 from account-insights:
 * {"error":"Invalid accountId format", param:"accountId"} — the username stored in
 * zernio_social_accounts (from profile.accountUsernames, see listZernioAccounts above)
 * isn't a valid accountId for analytics calls. Completely unconfirmed path/shape; logged
 * via zernioFetch so a wrong guess here just shows up in Vercel logs rather than breaking
 * anything — deliberately NOT wired into listZernioAccounts/the connect flow, which
 * already works, to avoid risking a regression while chasing this.
 */
async function findZernioAccountId(username: string): Promise<string | null> {
  const profileId = requireProfileId();
  const res = await zernioFetch(`/accounts?profileId=${encodeURIComponent(profileId)}`);
  if (!res.ok || !Array.isArray(res.data?.accounts ?? res.data)) return null;
  const list = res.data.accounts ?? res.data;
  const match = list.find((a: Record<string, unknown>) => a.username === username || a.name === username);
  const id = match?.accountId ?? match?.id ?? match?._id;
  return typeof id === "string" ? id : typeof id === "number" ? String(id) : null;
}

/**
 * GET /v1/analytics/instagram/account-insights?profileId=...&accountId=... — Instagram
 * account-level insights. UNVERIFIED path and field names — docs.zernio.com couldn't be
 * fetched directly, this is built from indexed search snippets of
 * docs.zernio.com/analytics/get-instagram-account-insights: available metrics are
 * reach, views, accounts_engaged, total_interactions, comments, likes, saves, shares,
 * replies, reposts, follows_and_unfollows, profile_links_taps — only "reach" has a real
 * time-series history, the rest are current totals only. Follower count reportedly comes
 * from a separate "daily snapshotter" rather than this same payload; the field name below
 * (follower_count) is a guess, not confirmed — expect this one specifically to come back
 * null until checked against a real response.
 */
export async function getZernioInstagramInsights(accountId: string): Promise<ZernioAccountInsights> {
  const empty: ZernioAccountInsights = { reach: null, totalInteractions: null, accountsEngaged: null, followerCount: null };
  const profileId = requireProfileId();
  // `accountId` as stored is actually the Zernio username — try to resolve the real
  // accountId first (see findZernioAccountId above); fall back to the raw value so a
  // failed probe doesn't make this strictly worse than before.
  const resolvedId = (await findZernioAccountId(accountId)) ?? accountId;
  const params = new URLSearchParams({ profileId, accountId: resolvedId });
  const res = await zernioFetch(`/analytics/instagram/account-insights?${params}`);
  if (!res.ok || !res.data) return empty;
  const d = res.data;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    reach: num(d.reach),
    totalInteractions: num(d.total_interactions ?? d.totalInteractions),
    accountsEngaged: num(d.accounts_engaged ?? d.accountsEngaged),
    followerCount: num(d.follower_count ?? d.followerCount),
  };
}
