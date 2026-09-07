import { supabase, STORE_PRODUCTS } from "@/lib/supabase";
import { parsePrice } from "@/lib/utils";
import MarqueeTicker from "@/components/store/MarqueeTicker";
import ProductBrowser from "@/components/store/ProductBrowser";
import TrackSearch from "./TrackSearch";
import { buildPageMetadata } from "@/lib/site-settings";

export const revalidate = 60;

export function generateMetadata() {
  return buildPageMetadata("products", "All Products — Vertex Rental Cars");
}

const CATEGORIES = [
  { label: "All", href: "/products" },
  { label: "Women (All Products)", href: "/women" },
  { label: "Sale | Clearance", href: "/clearance" },
  { label: "Women's Hair", href: "/women-hair" },
  { label: "Women's Skin", href: "/women-skin" },
  { label: "Men (All Products)", href: "/men" },
  { label: "Professional Line", href: "/professional" },
];

async function getProducts(search?: string) {
  let query = supabase.from(STORE_PRODUCTS).select("*");
  if (search) query = query.ilike("Produto Nome", `%${search}%`);
  const { data } = await query.limit(300);
  return (data || []).filter((p) => parsePrice(p["Valor de venda (Online)"]) > 0);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const products = await getProducts(search);

  return (
    <>
      <MarqueeTicker />
      {search && <TrackSearch query={search} />}
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        {search && (
          <p className="text-sm text-gray-500 mb-4">
            Results for <span className="font-medium text-gray-900">“{search}”</span>
          </p>
        )}
        <ProductBrowser
          products={products}
          categories={CATEGORIES.map((c) => ({ ...c, active: c.href === "/products" && !search }))}
        />
      </div>
    </>
  );
}
