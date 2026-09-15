import { supabase, STORE_PRODUCTS, type Product } from "@/lib/supabase";
import { parsePrice } from "@/lib/utils";
import ClearanceCarousel from "./ClearanceCarousel";

export default async function HomeClearanceSection() {
  const { data } = await supabase.from(STORE_PRODUCTS).select("*").limit(300);
  const products = (data || []).filter((p: Product) => {
    if (parsePrice(p.daily_rate) <= 0) return false;
    const cats = Array.isArray(p.store_categories) ? p.store_categories : [];
    return cats.includes("clearance");
  });
  if (products.length === 0) return null;

  // Shuffle so mid-page clearance shows in random order
  const shuffled = [...products].sort(() => Math.random() - 0.5);
  return <ClearanceCarousel products={shuffled} />;
}
