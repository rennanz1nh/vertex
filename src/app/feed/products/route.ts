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
      const name = p["Produto Nome"];
      const priceRaw = p["Valor de venda (Online)"];
      if (!name || !priceRaw) return "";

      const { price } = getEffectivePrice(priceRaw, p.sale_price);
      if (!price || price <= 0) return "";

      const stock = parseInt(p["Quantidade no Estoque"] || "0");
      const image = absoluteUrl(p.image_url || getProductImage(name), siteUrl);
      const description = p["Informacoes dos produtos / descricao"] || name;
      const link = `${siteUrl}/products/${p.id}`;

      return [
        "    <item>",
        `      <g:id>${xmlEscape(p.id)}</g:id>`,
        `      <title>${cdata(name)}</title>`,
        `      <description>${cdata(description)}</description>`,
        `      <link>${xmlEscape(link)}</link>`,
        image ? `      <g:image_link>${xmlEscape(image)}</g:image_link>` : "",
        `      <g:availability>${stock > 0 ? "in stock" : "out of stock"}</g:availability>`,
        `      <g:price>${price.toFixed(2)} USD</g:price>`,
        `      <g:condition>new</g:condition>`,
        p.Marca ? `      <g:brand>${cdata(p.Marca)}</g:brand>` : "",
        p.SKU ? `      <g:mpn>${xmlEscape(p.SKU)}</g:mpn>` : "",
        `      <g:identifier_exists>${p.SKU ? "yes" : "no"}</g:identifier_exists>`,
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
