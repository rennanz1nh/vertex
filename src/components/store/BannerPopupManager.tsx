"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getRibbonClassName } from "@/lib/ribbon";
import { pathnameToPageKey, type Banner } from "@/lib/banners";

const RIBBON_POSITION_CLASS: Record<string, string> = {
  "top-left": "top-3 left-3",
  "top-right": "top-3 right-3",
  "bottom-left": "bottom-3 left-3",
  "bottom-right": "bottom-3 right-3",
};

// Fixed regardless of the banner's own media dimensions — every photo/video crops
// (object-cover) to fill this same box, so the frame never resizes between banners.
const FRAME_RATIO = "5 / 4";

const dismissedKey = (id: string) => `banner-popup-dismissed:${id}`;

/**
 * Site-wide popup banner — receives every active popup banner (fetched once
 * in the store layout) and shows the first one matching the current page
 * (or targeting "*", all pages) that hasn't been dismissed this session.
 */
export default function BannerPopupManager({ banners }: { banners: Banner[] }) {
  const pathname = usePathname();
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const pageKey = pathnameToPageKey(pathname);
    const match = [...banners]
      .filter((b) => b.page === "*" || b.page === pageKey)
      .sort((a, b) => a.sort_order - b.sort_order)
      .find((b) => sessionStorage.getItem(dismissedKey(b.id)) !== "1");
    setBanner(match ?? null);
  }, [pathname, banners]);

  if (!banner) return null;

  function dismiss() {
    if (banner) sessionStorage.setItem(dismissedKey(banner.id), "1");
    setBanner(null);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="max-w-lg sm:max-w-2xl gap-0 overflow-hidden p-6 sm:p-8">
        <DialogTitle className="sr-only">{banner.title}</DialogTitle>
        <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr] gap-6 sm:gap-8 items-center">
          <div
            className="relative w-full overflow-hidden rounded-[10px] shadow-[0_1px_2px_rgba(20,17,13,0.06),0_12px_28px_-14px_rgba(20,17,13,0.22)]"
            style={{ aspectRatio: FRAME_RATIO }}
          >
            {banner.media_type === "video" ? (
              <video
                src={banner.media_url}
                className="absolute inset-0 h-full w-full object-cover object-center"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={banner.media_url} alt={banner.title} className="absolute inset-0 h-full w-full object-cover object-center" />
            )}
            {banner.ribbon_text && (
              <span
                className={`absolute z-10 rounded px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-md ${RIBBON_POSITION_CLASS[banner.ribbon_position]} ${getRibbonClassName(banner.ribbon_color)}`}
              >
                {banner.ribbon_text}
              </span>
            )}
          </div>

          <div className="text-center sm:text-left">
            {banner.overlay_text && (
              <p className="font-serif text-2xl leading-tight tracking-[-0.01em] text-balance mb-2">{banner.overlay_text}</p>
            )}
            {banner.subtitle_text && (
              <p className="text-muted-foreground text-sm leading-relaxed mb-5">{banner.subtitle_text}</p>
            )}
            {banner.link_url && (
              <a
                href={banner.link_url}
                onClick={dismiss}
                className="inline-flex items-center justify-center bg-black text-white text-sm font-semibold tracking-wide px-8 py-3 hover:bg-brand transition-colors"
              >
                {banner.button_text || "Saiba mais"}
              </a>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
