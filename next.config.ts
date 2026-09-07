import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.wixstatic.com" },
    ],
  },
  // These resolve their platform binary via a runtime-computed require() path
  // (see node_modules/@ffmpeg-installer/ffmpeg/index.js), which Next's Server
  // Components bundler can't statically trace — left external so it hits real
  // Node `require` instead of a bundled (and broken) reference.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "@ffprobe-installer/ffprobe"],
  experimental: {
    // Turbopack's persistent dev cache (default since Next 16.1) rewrites many
    // small files under .next on every session. This project lives inside a
    // OneDrive-synced folder, and OneDrive locking those files mid-write is a
    // common cause of the dev server crashing on Windows — disabled here to
    // avoid the churn.
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
