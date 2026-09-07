import Image from "next/image";
import { supabase, STORE_PRODUCTS } from "@/lib/supabase";
import { parsePrice } from "@/lib/utils";
import type { CategoryConfig } from "@/lib/categories";
import PageBanner from "./PageBanner";
import WomenSubnav from "./WomenSubnav";
import ProductBrowser from "./ProductBrowser";

async function getCategoryProducts(cfg: CategoryConfig) {
  let query = supabase.from(STORE_PRODUCTS).select("*");
  if (cfg.brand) query = query.eq("Marca", cfg.brand);
  const { data } = await query.limit(300);
  let rows = (data || []).filter((p) => parsePrice(p["Valor de venda (Online)"]) > 0);

  // No specific store category (e.g. /women main catalog) → show everything visible.
  if (!cfg.storeCategory) return rows;

  const lineSet = cfg.lines ? new Set(cfg.lines.map((l) => l.toLowerCase())) : null;
  rows = rows.filter((p) => {
    const assigned = Array.isArray(p.store_categories) ? p.store_categories : [];
    // admin-assigned categories take precedence
    if (assigned.length > 0) return assigned.includes(cfg.storeCategory as string);
    // fallback for products without assigned categories: legacy line heuristic
    if (lineSet) return lineSet.has((p["Linha do produto"] || "").trim().toLowerCase());
    return false;
  });
  return rows;
}

export default async function CategoryListing({ cfg }: { cfg: CategoryConfig }) {
  const products = await getCategoryProducts(cfg);

  return (
    <>
      {!cfg.hideBanner && <PageBanner src={cfg.banner} alt={cfg.title} ratio={cfg.bannerRatio} ext={cfg.bannerExt} />}
      {cfg.womenSubnav && <WomenSubnav />}

      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <h1 className="font-display text-2xl md:text-3xl font-normal text-gray-900 text-center mb-8">
          {cfg.title}
        </h1>

        {products.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-sm">We don&apos;t have any products to show here right now.</p>
          </div>
        ) : (
          <ProductBrowser products={products} />
        )}
      </div>

      {/* Secondary promo banners (after products), matching the Wix site */}
      {cfg.secondaryBanners && (
        <div className="max-w-[1600px] mx-auto px-4 pb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="relative aspect-[800/440] bg-gray-100 overflow-hidden">
                <Image
                  src={`/banners/secondary/${cfg.slug}-${n}.jpg`}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
