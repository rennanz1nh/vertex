import { supabase, STORE_PRODUCTS } from "@/lib/supabase";
import { parsePrice } from "@/lib/utils";
import MarqueeTicker from "@/components/store/MarqueeTicker";
import ProductBrowser from "@/components/store/ProductBrowser";
import AvailabilitySearchBar from "@/components/store/AvailabilitySearchBar";
import TrackSearch from "./TrackSearch";
import { buildPageMetadata } from "@/lib/site-settings";
import { STORE_CATEGORY_OPTIONS } from "@/lib/categories";
import { getUnavailableCarIds, isValidDateRange } from "@/lib/car-availability";
import { formatUsDate } from "@/lib/date-utils";

export const revalidate = 60;

export function generateMetadata() {
  return buildPageMetadata("products", "All Vehicles — Vertex Rental Cars");
}

const CATEGORIES = [
  { label: "All Vehicles", href: "/products" },
  ...STORE_CATEGORY_OPTIONS.map((c) => ({ label: c.label, href: `/products?category=${c.value}` })),
];

async function getProducts(search?: string, category?: string, pickupDate?: string, returnDate?: string) {
  let query = supabase.from(STORE_PRODUCTS).select("*");
  if (search) query = query.ilike("name", `%${search}%`);
  const { data } = await query.limit(300);
  let rows = (data || []).filter((p) => parsePrice(p.daily_rate) > 0);
  if (category) {
    rows = rows.filter((p) => (Array.isArray(p.store_categories) ? p.store_categories : []).includes(category));
  }
  if (isValidDateRange(pickupDate, returnDate)) {
    const unavailable = await getUnavailableCarIds(pickupDate!, returnDate!);
    rows = rows.filter((p) => !unavailable.has(p.id));
  }
  return rows;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; pickupDate?: string; pickupTime?: string; returnDate?: string; returnTime?: string }>;
}) {
  const { search, category, pickupDate, pickupTime, returnDate, returnTime } = await searchParams;
  const hasDateRange = isValidDateRange(pickupDate, returnDate);
  const products = await getProducts(search, category, pickupDate, returnDate);
  const categoryLabel = STORE_CATEGORY_OPTIONS.find((c) => c.value === category)?.label;

  return (
    <>
      <MarqueeTicker />
      {search && <TrackSearch query={search} />}
      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="mb-6">
          <AvailabilitySearchBar
            defaultPickupDate={pickupDate}
            defaultPickupTime={pickupTime}
            defaultReturnDate={returnDate}
            defaultReturnTime={returnTime}
          />
        </div>
        {search && (
          <p className="text-sm text-gray-500 mb-4">
            Results for <span className="font-medium text-gray-900">“{search}”</span>
          </p>
        )}
        {!search && categoryLabel && (
          <p className="text-sm text-gray-500 mb-4">
            Showing <span className="font-medium text-gray-900">{categoryLabel}</span> vehicles
          </p>
        )}
        {hasDateRange && (
          <p className="text-sm text-gray-500 mb-4">
            Showing vehicles available{" "}
            <span className="font-medium text-gray-900">
              {formatUsDate(pickupDate!)} &ndash; {formatUsDate(returnDate!)}
            </span>
          </p>
        )}
        <ProductBrowser
          products={products}
          categories={CATEGORIES.map((c) => ({
            ...c,
            active: category ? c.href === `/products?category=${category}` : c.href === "/products" && !search,
          }))}
        />
      </div>
    </>
  );
}
