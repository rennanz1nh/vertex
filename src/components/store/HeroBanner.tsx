import Image from "next/image";
import { supabase } from "@/lib/supabase";
import HeroBannerCarousel from "./HeroBannerCarousel";
import type { Banner } from "@/lib/banners";

const RATIO = 4.64;

/**
 * Homepage hero — a wide, contained banner matching the Wix reference
 * (1600×345, ratio ≈ 4.64, no text overlay by default). Admin can manage one
 * or several (Settings > Pop-ups > Banners, page "home"); with more than one
 * active they rotate automatically, each cropped to this exact same frame
 * regardless of the uploaded photo's own size. Falls back to the static
 * image when none are configured.
 */
export default async function HeroBanner() {
  const { data } = await supabase
    .from("banners")
    .select("*")
    .eq("page", "home")
    .eq("placement", "hero")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (data && data.length > 0) {
    return <HeroBannerCarousel banners={data as Banner[]} ratio={RATIO} />;
  }

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      <div
        className="relative w-full min-h-[140px] md:min-h-0"
        style={{ aspectRatio: "4.64" }}
      >
        <Image
          src="/images/home-hero.jpg"
          alt="Vertex Rental Cars"
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 1600px) 100vw, 1600px"
        />
      </div>
    </div>
  );
}
