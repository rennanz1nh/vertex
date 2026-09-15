// Category configuration for the Special Offers / clearance rail — the only page still
// rendered through CategoryListing. Vehicle classes (Compact/Big Van/Luxe/Sport) are
// filtered via /products?category=<slug> instead of dedicated routes — see
// STORE_CATEGORY_OPTIONS below, which both the admin car form and that query param use.

export type CategoryConfig = {
  slug: string;
  title: string;
  /** banner file under /public/banners (without extension) */
  banner: string;
  bannerExt?: "jpg" | "png";
  /** banner box width/height ratio (default 6.55) */
  bannerRatio?: number;
  /** skip the hero banner at the top of the category page */
  hideBanner?: boolean;
  /** match cars whose store_categories includes this slug (admin-assigned) */
  storeCategory?: string;
};

export const CATEGORIES: Record<string, CategoryConfig> = {
  clearance: {
    slug: "clearance",
    title: "Special Offers",
    banner: "clearance",
    hideBanner: true,
    storeCategory: "clearance",
  },
};

/** Vehicle classes a car can be tagged with — admin car form, homepage category tiles,
 *  and /products?category=<value> all use these same slugs. */
export const STORE_CATEGORY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "big-van", label: "Big Van" },
  { value: "luxe", label: "Luxe" },
  { value: "sport", label: "Sport" },
  { value: "clearance", label: "Special Offers" },
];
