// Client-side video ingestion helpers. There's no ffmpeg available
// server-side here (see docs/social-media-mcp.md — Vercel serverless +
// Supabase Edge Functions, no persistent process), so for a human-driven
// upload the browser does what ffmpeg would otherwise do: hash the file,
// read duration/dimensions, and capture a thumbnail frame. The automated
// watch-folder path (Phase 13) has no browser and revisits this.

export async function computeSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
}

function loadVideoElement(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read video metadata — is this a valid video file?"));
    };
    video.src = url;
  });
}

export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  const { video, url } = await loadVideoElement(file);
  try {
    return { durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Captures a JPEG thumbnail from the frame at `atSeconds` (clamped to the video's duration). */
export async function captureVideoThumbnail(file: File, atSeconds = 1): Promise<Blob> {
  const { video, url } = await loadVideoElement(file);
  try {
    const seekTo = Math.min(atSeconds, Math.max(video.duration - 0.1, 0));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Could not seek video for thumbnail capture"));
      video.currentTime = seekTo;
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode thumbnail"))), "image/jpeg", 0.8);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
