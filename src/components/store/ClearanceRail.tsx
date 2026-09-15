import { supabase, STORE_PRODUCTS, type Product } from "@/lib/supabase";
import { parsePrice } from "@/lib/utils";
import ClearanceCarousel from "./ClearanceCarousel";

/** Server wrapper: fetches products tagged "clearance" and feeds the carousel. */
export default async function ClearanceRail() {
  const { data } = await supabase.from(STORE_PRODUCTS).select("*").limit(300);
  const products = (data || []).filter((p: Product) => {
    if (parsePrice(p.daily_rate) <= 0) return false;
    const cats = Array.isArray(p.store_categories) ? p.store_categories : [];
    return cats.includes("clearance");
  });
  if (products.length === 0) return null;
  return <ClearanceCarousel products={products} />;
}
