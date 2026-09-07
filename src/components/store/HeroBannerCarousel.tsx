"use client";

import { useEffect, useState } from "react";
import BannerMedia from "./BannerMedia";
import type { Banner } from "@/lib/banners";

type Props = { banners: Banner[]; ratio: number };

/**
 * Rotates through every active "hero" banner for a page, each rendered with
 * the same unchanged BannerMedia (same fixed aspect-ratio frame, object-cover)
 * so any photo/video — big or small — always crops to fit that one frame size.
 * Falls back to no rotation at all when there's just a single banner.
 */
export default function HeroBannerCarousel({ banners, ratio }: Props) {
  const [index, setIndex] = useState(0);
  const active = banners[index];

  useEffect(() => {
    if (banners.length <= 1) return;
    const durationMs = (banners[index]?.duration_seconds ?? 5) * 1000;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % banners.length), durationMs);
    return () => clearTimeout(timer);
  }, [index, banners]);

  if (!active) return null;

  return (
    <div className="relative">
      <BannerMedia banner={active} ratio={ratio} />
      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ver banner ${i + 1} de ${banners.length}`}
              aria-current={i === index}
              className={`h-2 rounded-full transition-all ${i === index ? "w-6 bg-black" : "w-2 bg-black/25 hover:bg-black/40"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
