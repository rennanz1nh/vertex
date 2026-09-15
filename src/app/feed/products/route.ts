import { supabase, STORE_PRODUCTS, type Product } from "@/lib/supabase";
import { getSiteSettings } from "@/lib/site-settings";
import { resolveSiteUrl, absoluteUrl } from "@/lib/seo";
import { getEffectivePrice } from "@/lib/pricing";
import { getProductImage } from "@/lib/product-images";

// Product feed in RSS 2.0 with the Google Merchant `g:` namespace. This same
// format is accepted by both Meta (Facebook/Instagram) Catalogue and Google
// Merchant Center as a scheduled feed URL: /feed/products
export const revalidate = 3600;

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

export async function GET() {
  const settings = await getSiteSettings();
  const siteUrl = resolveSiteUrl(settings);
  const siteName = settings?.site_name || "Vertex Rental Cars";

  const { data } = await supabase
    .from(STORE_PRODUCTS)
    .select("*")
    .eq("store_visible", true)
    .limit(1000);
  const products = (data as Product[] | null) ?? [];

  const items = products
    .map((p) => {
      const name = p.name || [p.year, p.make, p.model].filter(Boolean).join(" ");
      const priceRaw = p.daily_rate;
      if (!name || !priceRaw) return "";

      const { price } = getEffectivePrice(priceRaw, p.discounted_daily_rate);
      if (!price || price <= 0) return "";

      const image = absoluteUrl(p.image_url || getProductImage(name), siteUrl);
      const description = p.description || name;
      const link = `${siteUrl}/products/${p.id}`;

      return [
        "    <item>",
        `      <g:id>${xmlEscape(p.id)}</g:id>`,
        `      <title>${cdata(name)}</title>`,
        `      <description>${cdata(description)}</description>`,
        `      <link>${xmlEscape(link)}</link>`,
        image ? `      <g:image_link>${xmlEscape(image)}</g:image_link>` : "",
        // every row here is already store_visible = true (see the query below) — a single
        // vehicle listing has no separate stock quantity, so it's always "in stock".
        `      <g:availability>in stock</g:availability>`,
        `      <g:price>${price.toFixed(2)} USD</g:price>`,
        `      <g:condition>new</g:condition>`,
        p.make ? `      <g:brand>${cdata(p.make)}</g:brand>` : "",
        p.vin ? `      <g:mpn>${xmlEscape(p.vin)}</g:mpn>` : "",
        `      <g:identifier_exists>${p.vin ? "yes" : "no"}</g:identifier_exists>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${cdata(siteName)}</title>
    <link>${xmlEscape(siteUrl)}</link>
    <description>${cdata(`${siteName} product feed`)}</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
