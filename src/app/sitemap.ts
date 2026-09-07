import type { MetadataRoute } from "next";
import { supabase, STORE_PRODUCTS } from "@/lib/supabase";
import { getSiteSettings } from "@/lib/site-settings";
import { resolveSiteUrl, SEO_PAGE_OPTIONS } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  const siteUrl = resolveSiteUrl(settings);

  // Static + category pages (from the SEO page list), deduped.
  const staticEntries: MetadataRoute.Sitemap = SEO_PAGE_OPTIONS.map((p) => ({
    url: `${siteUrl}${p.path === "/" ? "" : p.path}` || siteUrl,
    changeFrequency: "weekly",
    priority: p.value === "home" ? 1 : 0.7,
  }));

  // All published products.
  const { data } = await supabase
    .from(STORE_PRODUCTS)
    .select("id")
    .limit(1000);

  const productEntries: MetadataRoute.Sitemap = (data ?? []).map((p: { id: string }) => ({
    url: `${siteUrl}/products/${p.id}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...productEntries];
}
