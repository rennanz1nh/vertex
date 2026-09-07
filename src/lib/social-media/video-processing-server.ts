import { spawn } from "child_process";
import { createHash } from "crypto";
import { mkdtemp, readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

/**
 * Server-side counterpart to video-client.ts, which does the same job
 * (hash/duration/dimensions/thumbnail) in the browser for manual uploads.
 * The watch-folder pipeline (Phase 13) has no browser, so this shells out to
 * a bundled ffmpeg/ffprobe binary instead — a well-established pattern on
 * Vercel's Node.js serverless runtime, but a new, somewhat heavy dependency
 * (~140MB combined for both binaries) that this sandbox has no real video
 * file or live deployment to smoke-test end-to-end. Every call site treats
 * failures here as non-fatal: a video that can't be probed/thumbnailed
 * still gets registered, just without auto-analysis until someone looks at
 * it, rather than the whole watcher run failing.
 */

function run(binaryPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${path.basename(binaryPath)} exited with code ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

export interface ProbedVideoInfo {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
}

export async function probeVideoFile(filePath: string): Promise<ProbedVideoInfo> {
  const stdout = await run(ffprobeInstaller.path, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; format_name?: string };
    streams?: { codec_type?: string; width?: number; height?: number }[];
  };
  const videoStream = (parsed.streams ?? []).find((s) => s.codec_type === "video");
  const durationRaw = parsed.format?.duration;
  const duration = durationRaw !== undefined ? Number(durationRaw) : NaN;
  return {
    durationSeconds: Number.isFinite(duration) ? duration : null,
    width: typeof videoStream?.width === "number" ? videoStream.width : null,
    height: typeof videoStream?.height === "number" ? videoStream.height : null,
    format: parsed.format?.format_name ?? null,
  };
}

/** Grabs one frame as a JPEG. Clamps the requested timestamp to 0 so a very short clip doesn't fail with a seek-past-end error. */
export async function extractThumbnailFile(filePath: string, atSeconds: number): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "social-thumb-"));
  const outputPath = path.join(dir, "thumb.jpg");
  try {
    await run(ffmpegInstaller.path, ["-y", "-ss", String(Math.max(0, atSeconds)), "-i", filePath, "-frames:v", "1", "-q:v", "3", outputPath]);
    return await readFile(outputPath);
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}

export function sha256OfBuffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Writes `bytes` to a throwaway temp file for the duration of `fn`, then removes it — ffmpeg/ffprobe need a real file path, not a stream. */
export async function withTempVideoFile<T>(bytes: Buffer, extension: string, fn: (filePath: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "social-video-"));
  const filePath = path.join(dir, `input.${extension || "mp4"}`);
  await writeFile(filePath, bytes);
  try {
    return await fn(filePath);
  } finally {
    await unlink(filePath).catch(() => {});
  }
}
