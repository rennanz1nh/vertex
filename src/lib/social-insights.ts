import type { SocialPlatform } from "@/lib/social-platforms";

export interface SocialPost {
  id: string;
  caption: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  publishedAt: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  views: number | null;
}

export interface SocialInsights {
  followers: number | null;
  postCount: number | null;
  posts: SocialPost[];
}

const EMPTY: SocialInsights = { followers: null, postCount: null, posts: [] };

export async function fetchSocialInsights(
  platform: SocialPlatform,
  accessToken: string,
  accountId: string | null
): Promise<SocialInsights> {
  switch (platform) {
    case "instagram":
      return fetchInstagramInsights(accessToken, accountId);
    case "facebook":
      return fetchFacebookInsights(accessToken, accountId);
    case "tiktok":
      return fetchTikTokInsights(accessToken);
    case "youtube":
      return fetchYouTubeInsights(accessToken);
    case "pinterest":
      return fetchPinterestInsights(accessToken);
    default:
      return EMPTY;
  }
}

async function fetchInstagramInsights(accessToken: string, igUserId: string | null): Promise<SocialInsights> {
  if (!igUserId) return EMPTY;

  const [accountRes, mediaRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v19.0/${igUserId}?fields=followers_count,media_count&access_token=${encodeURIComponent(accessToken)}`),
    fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media?fields=id,caption,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=12&access_token=${encodeURIComponent(accessToken)}`
    ),
  ]);
  const account = await accountRes.json();
  const media = await mediaRes.json();

  const posts: SocialPost[] = (media?.data ?? []).map((m: any) => ({
    id: m.id,
    caption: m.caption ?? null,
    thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
    permalink: m.permalink ?? null,
    publishedAt: m.timestamp ?? null,
    likes: m.like_count ?? null,
    comments: m.comments_count ?? null,
    shares: null,
    views: null,
  }));

  return { followers: account?.followers_count ?? null, postCount: account?.media_count ?? null, posts };
}

async function fetchFacebookInsights(accessToken: string, pageId: string | null): Promise<SocialInsights> {
  if (!pageId) return EMPTY;

  const [pageRes, postsRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=followers_count&access_token=${encodeURIComponent(accessToken)}`),
    fetch(
      `https://graph.facebook.com/v19.0/${pageId}/posts?fields=id,message,full_picture,permalink_url,created_time,likes.summary(true),comments.summary(true),shares&limit=12&access_token=${encodeURIComponent(accessToken)}`
    ),
  ]);
  const page = await pageRes.json();
  const posts_ = await postsRes.json();

  const posts: SocialPost[] = (posts_?.data ?? []).map((p: any) => ({
    id: p.id,
    caption: p.message ?? null,
    thumbnailUrl: p.full_picture ?? null,
    permalink: p.permalink_url ?? null,
    publishedAt: p.created_time ?? null,
    likes: p.likes?.summary?.total_count ?? null,
    comments: p.comments?.summary?.total_count ?? null,
    shares: p.shares?.count ?? null,
    views: null,
  }));

  return { followers: page?.followers_count ?? null, postCount: posts.length || null, posts };
}

async function fetchTikTokInsights(accessToken: string): Promise<SocialInsights> {
  const [userRes, videoRes] = await Promise.all([
    fetch("https://open.tiktokapis.com/v2/user/info/?fields=follower_count,video_count", {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch("https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,create_time,like_count,comment_count,share_count,view_count", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ max_count: 12 }),
    }),
  ]);
  const user = await userRes.json();
  const videos = await videoRes.json();

  const posts: SocialPost[] = (videos?.data?.videos ?? []).map((v: any) => ({
    id: v.id,
    caption: v.title ?? null,
    thumbnailUrl: v.cover_image_url ?? null,
    permalink: v.share_url ?? null,
    publishedAt: v.create_time ? new Date(v.create_time * 1000).toISOString() : null,
    likes: v.like_count ?? null,
    comments: v.comment_count ?? null,
    shares: v.share_count ?? null,
    views: v.view_count ?? null,
  }));

  return {
    followers: user?.data?.user?.follower_count ?? null,
    postCount: user?.data?.user?.video_count ?? null,
    posts,
  };
}

async function fetchYouTubeInsights(accessToken: string): Promise<SocialInsights> {
  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const channel = await channelRes.json();
  const stats = channel?.items?.[0]?.statistics;
  const uploadsPlaylistId = channel?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    return { followers: Number(stats?.subscriberCount) || null, postCount: Number(stats?.videoCount) || null, posts: [] };
  }

  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=12`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const playlist = await playlistRes.json();
  const videoIds = (playlist?.items ?? []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);

  let videoStats: Record<string, any> = {};
  if (videoIds.length) {
    const videosRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds.join(",")}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const videosData = await videosRes.json();
    videoStats = Object.fromEntries((videosData?.items ?? []).map((v: any) => [v.id, v.statistics]));
  }

  const posts: SocialPost[] = (playlist?.items ?? []).map((i: any) => {
    const videoId = i.contentDetails?.videoId;
    const s = videoStats[videoId] ?? {};
    return {
      id: videoId,
      caption: i.snippet?.title ?? null,
      thumbnailUrl: i.snippet?.thumbnails?.medium?.url ?? i.snippet?.thumbnails?.default?.url ?? null,
      permalink: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
      publishedAt: i.snippet?.publishedAt ?? null,
      likes: Number(s.likeCount) || null,
      comments: Number(s.commentCount) || null,
      shares: null,
      views: Number(s.viewCount) || null,
    };
  });

  return { followers: Number(stats?.subscriberCount) || null, postCount: Number(stats?.videoCount) || null, posts };
}

// Pinterest v5 doesn't return per-pin engagement counts on the plain list endpoint —
// that needs a separate analytics call per pin (date-ranged, only for business
// accounts). Listing pins works now; engagement numbers are a later addition once
// that's wired up and tested against a real connected account.
async function fetchPinterestInsights(accessToken: string): Promise<SocialInsights> {
  const res = await fetch("https://api.pinterest.com/v5/pins?page_size=12", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();

  const posts: SocialPost[] = (data?.items ?? []).map((p: any) => ({
    id: p.id,
    caption: p.title ?? p.description ?? null,
    thumbnailUrl: p.media?.images?.["600x"]?.url ?? null,
    permalink: p.link ?? null,
    publishedAt: p.created_at ?? null,
    likes: null,
    comments: null,
    shares: null,
    views: null,
  }));

  return { followers: null, postCount: posts.length || null, posts };
}
