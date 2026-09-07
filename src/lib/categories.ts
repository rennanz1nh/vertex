// Category configuration mapping each store route to its banner + product
// filter. Product data is organised by "Linha do produto" (product line);
// these groupings mirror how the Wix reference site presents the catalog.

export type CategoryConfig = {
  slug: string;
  title: string;
  /** banner file under /public/banners (without extension) */
  banner: string;
  bannerExt?: "jpg" | "png";
  /** banner box width/height ratio, matching the Wix site (default 6.55) */
  bannerRatio?: number;
  /** two promo banners shown after the products (files: /banners/secondary/{slug}-1|2.jpg) */
  secondaryBanners?: boolean;
  /** skip the hero banner at the top of the category page */
  hideBanner?: boolean;
  /** show the Women sub-nav (Skin / Body / Hair / Professional) */
  womenSubnav?: boolean;
  /** match products whose store_category equals this slug (admin-assigned) */
  storeCategory?: string;
  /** fallback for products without an assigned store_category: match these lines */
  lines?: string[];
  /** only include products of this brand */
  brand?: string;
};

const SKIN_LINES = ["Argilo Detox", "Pro Luminous"];
const HAIR_LINES = [
  "Amino Plex",
  "Daily Therapy",
  "Just Sofistic",
  "Ultimate Liss",
  "Therapy Liss",
  "Silver Therapy",
  "Al-kimya",
  "Instant Plex",
  "Travel Kit",
];

export const CATEGORIES: Record<string, CategoryConfig> = {
  women: {
    slug: "women",
    title: "Choose the right for you!",
    banner: "women",
    womenSubnav: true,
    secondaryBanners: true,
  },
  "women-skin": {
    slug: "women-skin",
    title: "Explore the Women's Collection",
    banner: "women-skin",
    bannerRatio: 4.1,
    womenSubnav: true,
    storeCategory: "women-skin",
    lines: SKIN_LINES,
    secondaryBanners: true,
  },
  "women-body": {
    slug: "women-body",
    title: "Explore the Women's Collection",
    banner: "women-body",
    womenSubnav: true,
    storeCategory: "women-body",
    secondaryBanners: true,
  },
  "women-hair": {
    slug: "women-hair",
    title: "Explore the Women's Collection",
    banner: "women-hair",
    womenSubnav: true,
    storeCategory: "women-hair",
    lines: HAIR_LINES,
    secondaryBanners: true,
  },
  professional: {
    slug: "professional",
    title: "Professional Line",
    banner: "professional",
    womenSubnav: true,
    storeCategory: "professional",
    secondaryBanners: true,
  },
  men: {
    slug: "men",
    title: "Explore the Men's Collection",
    banner: "men",
    storeCategory: "men",
    secondaryBanners: true,
  },
  clearance: {
    slug: "clearance",
    title: "Clearance",
    banner: "clearance",
    hideBanner: true,
    storeCategory: "clearance",
  },
};

/** Sub-nav shown on Women-section pages, matching the Wix "Choose by:" bar. */
export const WOMEN_SUBNAV = [
  { label: "Skin", href: "/women-skin" },
  { label: "Body", href: "/women-body" },
  { label: "Hair", href: "/women-hair" },
  { label: "Professional", href: "/professional" },
];

/** Store collections a product can be assigned to (admin product modal). */
export const STORE_CATEGORY_OPTIONS = [
  { value: "women", label: "Women (All Products)" },
  { value: "women-skin", label: "Women's Skin" },
  { value: "women-body", label: "Women's Body" },
  { value: "women-hair", label: "Women's Hair" },
  { value: "professional", label: "Professional" },
  { value: "men", label: "Men" },
  { value: "clearance", label: "Sale | Clearance" },
];
