import { supabase, STORE_PRODUCTS } from "@/lib/supabase";
import { parsePrice } from "@/lib/utils";
import type { CategoryConfig } from "@/lib/categories";
import PageBanner from "./PageBanner";
import ProductBrowser from "./ProductBrowser";

async function getCategoryProducts(cfg: CategoryConfig) {
  const { data } = await supabase.from(STORE_PRODUCTS).select("*").limit(300);
  let rows = (data || []).filter((p) => parsePrice(p.daily_rate) > 0);

  if (!cfg.storeCategory) return rows;

  rows = rows.filter((p) => {
    const assigned = Array.isArray(p.store_categories) ? p.store_categories : [];
    return assigned.includes(cfg.storeCategory as string);
  });
  return rows;
}

export default async function CategoryListing({ cfg }: { cfg: CategoryConfig }) {
  const products = await getCategoryProducts(cfg);

  return (
    <>
      {!cfg.hideBanner && <PageBanner src={cfg.banner} alt={cfg.title} ratio={cfg.bannerRatio} ext={cfg.bannerExt} />}

      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <h1 className="font-display text-2xl md:text-3xl font-normal text-gray-900 text-center mb-8">
          {cfg.title}
        </h1>

        {products.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-sm">We don&apos;t have any vehicles to show here right now.</p>
          </div>
        ) : (
          <ProductBrowser products={products} />
        )}
      </div>
    </>
  );
}
