import { supabase, STORE_PRODUCTS } from "@/lib/supabase";
import { parsePrice } from "@/lib/utils";
import HeroBanner from "@/components/store/HeroBanner";
import MarqueeTicker from "@/components/store/MarqueeTicker";
import ProductBrowser from "@/components/store/ProductBrowser";
import CategoryTiles from "@/components/store/CategoryTiles";
import HomeClearanceSection from "@/components/store/HomeClearanceSection";
import LearnMoreSection from "@/components/store/LearnMoreSection";
import { buildPageMetadata } from "@/lib/site-settings";
import { STORE_CATEGORY_OPTIONS } from "@/lib/categories";

export const revalidate = 60;

export function generateMetadata() {
  return buildPageMetadata("home");
}

const CATEGORIES = [
  { label: "All Vehicles", href: "/products" },
  ...STORE_CATEGORY_OPTIONS.map((c) => ({ label: c.label, href: `/products?category=${c.value}` })),
];

async function getProducts() {
  const { data } = await supabase.from(STORE_PRODUCTS).select("*").limit(300);
  return (data || []).filter((p) => parsePrice(p.daily_rate) > 0);
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <>
      <HeroBanner />
      <MarqueeTicker />

      {/* Products grid with Load More button */}
      <section className="max-w-[1600px] mx-auto px-4 py-8">
        <ProductBrowser products={products} categories={CATEGORIES} />
      </section>

      {/* Shop by Category */}
      <CategoryTiles />

      {/* Clearance — random order */}
      <HomeClearanceSection />

      {/* Know more about you banner */}
      <LearnMoreSection />

      {/* ClearanceRail (2nd clearance) + NewsletterSection are injected by the layout */}
    </>
  );
}
