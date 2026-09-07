import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site-settings";
import { resolveSiteUrl } from "@/lib/seo";

export const revalidate = 3600;

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();
  const siteUrl = resolveSiteUrl(settings);

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/checkout areas out of the index.
      disallow: ["/admin", "/api", "/checkout", "/cart"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
