import { supabase, STORE_PRODUCTS } from "@/lib/supabase";
import { parsePrice } from "@/lib/utils";
import HeroBanner from "@/components/store/HeroBanner";
import MarqueeTicker from "@/components/store/MarqueeTicker";
import ProductBrowser from "@/components/store/ProductBrowser";
import CategoryTiles from "@/components/store/CategoryTiles";
import AvailabilitySearchBar from "@/components/store/AvailabilitySearchBar";
import { buildPageMetadata } from "@/lib/site-settings";
import { STORE_CATEGORY_OPTIONS } from "@/lib/categories";
import { getUnavailableCarIds, isValidDateRange } from "@/lib/car-availability";
import { formatUsDate } from "@/lib/date-utils";

export const revalidate = 60;

export function generateMetadata() {
  return buildPageMetadata("home");
}

const CATEGORIES = [
  { label: "All Vehicles", href: "/products" },
  ...STORE_CATEGORY_OPTIONS.map((c) => ({ label: c.label, href: `/products?category=${c.value}` })),
];

async function getProducts(pickupDate?: string, returnDate?: string) {
  const { data } = await supabase.from(STORE_PRODUCTS).select("*").limit(300);
  let rows = (data || []).filter((p) => parsePrice(p.daily_rate) > 0);
  if (isValidDateRange(pickupDate, returnDate)) {
    const unavailable = await getUnavailableCarIds(pickupDate!, returnDate!);
    rows = rows.filter((p) => !unavailable.has(p.id));
  }
  return rows;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ pickupDate?: string; pickupTime?: string; returnDate?: string; returnTime?: string }>;
}) {
  const { pickupDate, pickupTime, returnDate, returnTime } = await searchParams;
  const hasDateRange = isValidDateRange(pickupDate, returnDate);
  const products = await getProducts(pickupDate, returnDate);

  return (
    <>
      <HeroBanner />
      <MarqueeTicker />

      {/* Availability search — Orlando only, so just dates/times; filters the grid below
          to vehicles with no overlapping booking when a valid range is in the URL. */}
      <div className="max-w-[1600px] mx-auto px-4 pt-8">
        <AvailabilitySearchBar
          defaultPickupDate={pickupDate}
          defaultPickupTime={pickupTime}
          defaultReturnDate={returnDate}
          defaultReturnTime={returnTime}
        />
      </div>

      {/* Products grid with Load More button */}
      <section className="max-w-[1600px] mx-auto px-4 py-8">
        {hasDateRange && (
          <p className="text-sm text-gray-500 mb-4">
            Showing vehicles available{" "}
            <span className="font-medium text-gray-900">
              {formatUsDate(pickupDate!)} &ndash; {formatUsDate(returnDate!)}
            </span>
          </p>
        )}
        <ProductBrowser products={products} categories={CATEGORIES} />
      </section>

      {/* Shop by Category */}
      <CategoryTiles />

      {/* Special Offers (ClearanceRail) + NewsletterSection are injected by the layout */}
    </>
  );
}
