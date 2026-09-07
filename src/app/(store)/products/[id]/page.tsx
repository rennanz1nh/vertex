import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabase, STORE_PRODUCTS, type Product } from "@/lib/supabase";
import { getSiteSettings, getProductSeo } from "@/lib/site-settings";
import { resolveSiteUrl, absoluteUrl } from "@/lib/seo";
import { getEffectivePrice } from "@/lib/pricing";
import { getProductImage } from "@/lib/product-images";
import ProductDetailClient from "./ProductDetailClient";

export const revalidate = 60;

// Cached per request so generateMetadata and the page don't double-fetch.
const getProduct = cache(async (id: string): Promise<Product | null> => {
  const { data } = await supabase.from(STORE_PRODUCTS).select("*").eq("id", id).maybeSingle();
  return (data as Product | null) ?? null;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [product, seo, settings] = await Promise.all([
    getProduct(id),
    getProductSeo(id),
    getSiteSettings(),
  ]);

  if (!product) return { title: "Product not found" };

  const siteUrl = resolveSiteUrl(settings);
  const name = product["Produto Nome"] || "Product";
  const title = seo?.title || `${name}${product.Marca ? ` — ${product.Marca}` : ""}`;
  const description =
    seo?.description ||
    product["Informacoes dos produtos / descricao"] ||
    settings?.default_description ||
    undefined;
  const image = absoluteUrl(
    seo?.og_image || product.image_url || getProductImage(name),
    siteUrl
  );
  const canonical = `${siteUrl}/products/${id}`;

  return {
    title,
    description,
    alternates: { canonical },
    robots: seo?.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: image ? [image] : undefined,
    },
    twitter: image ? { card: "summary_large_image", title, description, images: [image] } : undefined,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, settings] = await Promise.all([getProduct(id), getSiteSettings()]);

  if (!product) notFound();

  const siteUrl = resolveSiteUrl(settings);
  const name = product["Produto Nome"] || "Product";
  const { price } = getEffectivePrice(product["Valor de venda (Online)"], product.sale_price);
  const stock = parseInt(product["Quantidade no Estoque"] || "0");
  const image = absoluteUrl(product.image_url || getProductImage(name), siteUrl);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(image ? { image: [image] } : {}),
    ...(product["Informacoes dos produtos / descricao"]
      ? { description: product["Informacoes dos produtos / descricao"] }
      : {}),
    ...(product.SKU ? { sku: product.SKU } : {}),
    ...(product.Marca ? { brand: { "@type": "Brand", name: product.Marca } } : {}),
    offers: {
      "@type": "Offer",
      url: `${siteUrl}/products/${id}`,
      priceCurrency: "USD",
      price: price.toFixed(2),
      availability: stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient product={product} />
    </>
  );
}
