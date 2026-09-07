// Product gallery/cover URLs are plain strings with no stored media type (unlike
// banners, which have a dedicated media_type column) — video vs image is inferred
// from the file extension, which is safe since uploads always keep their original one.
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v"];

export function isVideoUrl(url: string): boolean {
  const clean = url.split("?")[0].toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => clean.endsWith(ext));
}
