// Shared types + constants for SEO and marketing integrations (Admin > Settings).

export const DEFAULT_SITE_URL = "https://vertexrentalcar.com";

export type SiteSettings = {
  id: string;
  site_url: string | null;
  site_name: string;
  default_title: string | null;
  default_description: string | null;
  default_og_image: string | null;
  ga4_measurement_id: string | null;
  gtm_container_id: string | null;
  google_ads_conversion_id: string | null;
  google_site_verification: string | null;
  business_name: string | null;
  business_phone: string | null;
  business_email: string | null;
  business_street: string | null;
  business_city: string | null;
  business_state: string | null;
  business_zip: string | null;
  business_country: string | null;
  business_hours: string | null;
  business_maps_url: string | null;
  facebook_pixel_id: string | null;
  facebook_domain_verification: string | null;
  facebook_page_url: string | null;
  whatsapp_number: string | null;
  updated_at: string;
};

export type PageSeo = {
  page_key: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  noindex: boolean;
};

export type ProductSeo = {
  product_id: string;
  title: string | null;
  description: string | null;
  og_image: string | null;
  noindex: boolean;
};

/** Pages that can have SEO overrides (Admin > Settings > SEO > Páginas). */
export const SEO_PAGE_OPTIONS = [
  { value: "home", label: "Home", path: "/" },
  { value: "products", label: "Todos os Veículos", path: "/products" },
  { value: "clearance", label: "Special Offers", path: "/clearance" },
  { value: "contact-us", label: "Contact Us", path: "/contact-us" },
] as const;

/** Returns the configured site URL, always without a trailing slash. */
export function resolveSiteUrl(settings: Pick<SiteSettings, "site_url"> | null | undefined): string {
  const raw = settings?.site_url?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, "");
}

/** Makes a possibly-relative image path absolute against the site URL. */
export function absoluteUrl(pathOrUrl: string | null | undefined, siteUrl: string): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${siteUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}
