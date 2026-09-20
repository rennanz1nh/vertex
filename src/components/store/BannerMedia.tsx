import Image from "next/image";
import { getRibbonClassName } from "@/lib/ribbon";
import type { Banner } from "@/lib/banners";

const RIBBON_POSITION_CLASS: Record<string, string> = {
  "top-left": "top-3 left-3",
  "top-right": "top-3 right-3",
  "bottom-left": "bottom-3 left-3",
  "bottom-right": "bottom-3 right-3",
};

type Props = {
  banner: Banner;
  /** width/height ratio of the banner box */
  ratio?: number;
};

/**
 * Renders one admin-managed banner: image or video, optional link wrapper,
 * optional centered overlay text, and an optional corner ribbon ("fita").
 */
export default function BannerMedia({ banner, ratio = 6.55 }: Props) {
  const media =
    banner.media_type === "video" ? (
      <video
        src={banner.media_url}
        className="absolute inset-0 h-full w-full object-cover object-center"
        autoPlay
        muted
        loop
        playsInline
      />
    ) : (
      <Image
        src={banner.media_url}
        alt={banner.title}
        fill
        priority
        quality={100}
        className="object-cover object-center"
        sizes="(max-width: 1600px) 100vw, 1600px"
      />
    );

  const box = (
    <div
      className="relative w-full min-h-[120px] md:min-h-0 overflow-hidden"
      style={{ aspectRatio: String(ratio) }}
    >
      {media}
      {banner.overlay_text && (
        <div className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none">
          <p className="max-w-[80%] rounded bg-black/40 px-4 py-2 text-center text-xl font-bold text-white drop-shadow-lg md:text-3xl">
            {banner.overlay_text}
          </p>
        </div>
      )}
      {banner.ribbon_text && (
        <span
          className={`absolute z-10 rounded px-3 py-1 text-xs font-bold uppercase tracking-wide shadow-md ${RIBBON_POSITION_CLASS[banner.ribbon_position]} ${getRibbonClassName(banner.ribbon_color)}`}
        >
          {banner.ribbon_text}
        </span>
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      {banner.link_url ? (
        <a href={banner.link_url} className="block">
          {box}
        </a>
      ) : (
        box
      )}
    </div>
  );
}
