import Image from "next/image";
import { supabase } from "@/lib/supabase";
import BannerMedia from "./BannerMedia";
import type { Banner } from "@/lib/banners";

type Props = {
  /** path under /public/banners, without extension, e.g. "women-skin" — also
   * used as the "page" key to look up an admin-managed banner override. */
  src: string;
  alt?: string;
  /** width/height ratio of the banner box (Wix: 6.55 standard, 4.1 skin, 6.39 contact) */
  ratio?: number;
  ext?: "jpg" | "png";
};

/**
 * Full-width page banner contained to the 1600px content width (matching the
 * Wix reference site, which is not full-bleed). The image crop/focal point is
 * baked into the file, so CSS only centers it. A min-height keeps very wide
 * banners from getting too thin on mobile. Admin can override it with a
 * managed banner (Settings > Banners) targeting the same page; falls back to
 * the static image otherwise.
 */
export default async function PageBanner({ src, alt = "", ratio = 6.55, ext = "jpg" }: Props) {
  const { data } = await supabase
    .from("banners")
    .select("*")
    .eq("page", src)
    .eq("placement", "hero")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data) {
    return <BannerMedia banner={data as Banner} ratio={ratio} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div
        className="relative w-full min-h-[120px] md:min-h-0"
        style={{ aspectRatio: String(ratio) }}
      >
        <Image
          src={`/banners/${src}.${ext}`}
          alt={alt}
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 1600px) 100vw, 1600px"
        />
      </div>
    </div>
  );
}
