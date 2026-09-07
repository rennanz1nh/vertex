// Server-side reads for SEO / integrations config. Uses the anon Supabase client
// (all three tables allow public SELECT). Safe to call from Server Components,
// generateMetadata, route handlers, sitemap and robots.

import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import {
  type SiteSettings,
  type PageSeo,
  type ProductSeo,
  resolveSiteUrl,
  absoluteUrl,
} from "@/lib/seo";

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const { data } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
  return (data as SiteSettings | null) ?? null;
}

export async function getPageSeo(pageKey: string): Promise<PageSeo | null> {
  const { data } = await supabase
    .from("page_seo")
    .select("*")
    .eq("page_key", pageKey)
    .maybeSingle();
  return (data as PageSeo | null) ?? null;
}

export async function getProductSeo(productId: string): Promise<ProductSeo | null> {
  const { data } = await supabase
    .from("product_seo")
    .select("*")
    .eq("product_id", productId)
    .maybeSingle();
  return (data as ProductSeo | null) ?? null;
}

/**
 * Builds a Next.js Metadata object for a static/category page, layering the
 * admin's per-page override on top of the site defaults.
 */
export async function buildPageMetadata(pageKey: string, fallbackTitle?: string): Promise<Metadata> {
  const [settings, page] = await Promise.all([getSiteSettings(), getPageSeo(pageKey)]);
  const siteUrl = resolveSiteUrl(settings);
  const siteName = settings?.site_name || "Vertex Rental Cars";

  const title = page?.title || fallbackTitle || settings?.default_title || siteName;
  const description = page?.description || settings?.default_description || undefined;
  const ogImage = absoluteUrl(page?.og_image || settings?.default_og_image, siteUrl);
  const pageOption = SEO_PAGE_PATH[pageKey];
  const canonical = pageOption ? `${siteUrl}${pageOption}` : undefined;

  return {
    title,
    description,
    alternates: canonical ? { canonical } : undefined,
    robots: page?.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      siteName,
      url: canonical,
      images: ogImage ? [ogImage] : undefined,
      type: "website",
    },
    twitter: ogImage
      ? { card: "summary_large_image", title, description, images: [ogImage] }
      : undefined,
  };
}

// Minimal page_key -> path map for canonical URLs (kept here to avoid importing
// the full options list into every page).
const SEO_PAGE_PATH: Record<string, string> = {
  home: "/",
  products: "/products",
  women: "/women",
  "women-skin": "/women-skin",
  "women-body": "/women-body",
  "women-hair": "/women-hair",
  professional: "/professional",
  men: "/men",
  clearance: "/clearance",
  "contact-us": "/contact-us",
  "sell-with-us": "/sell-with-us",
  courses: "/courses",
  ebooks: "/ebooks",
};
