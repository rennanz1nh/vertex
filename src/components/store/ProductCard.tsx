"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { formatPrice } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { getProductImage } from "@/lib/product-images";
import { getRibbonClassName } from "@/lib/ribbon";
import { trackViewContent } from "@/lib/facebook-pixel-events";
import type { Product } from "@/lib/supabase";

const BADGE_STYLES: Record<string, string> = {
  "Progressive (Brazilian)": "bg-brand text-white",
  "Brazilian Keratin": "bg-brand text-white",
  "Best Seller's": "bg-brand text-white",
  KIT: "bg-gray-200 text-gray-800",
};

function getBadge(product: Product): string | null {
  const linha = product["Linha do produto"] || "";
  if (linha.toLowerCase().includes("progressive") || linha.toLowerCase().includes("keratin"))
    return "Progressive (Brazilian)";
  if (linha.toLowerCase().includes("kit")) return "KIT";
  return null;
}

type Props = { product: Product };

export default function ProductCard({ product }: Props) {
  const name = product["Produto Nome"] || "Product";
  const { price, originalPrice } = getEffectivePrice(product["Valor de venda (Online)"], product.sale_price);
  const ribbonText = product.ribbon_text;
  const badge = ribbonText ? null : getBadge(product);
  const image = product.image_url || getProductImage(name);
  const hoverImage = product.gallery_urls?.[0] || null;

  useEffect(() => {
    trackViewContent(name, product.id, price, product.Marca);
  }, [product.id, name, price, product.Marca]);

  return (
    <Link href={`/products/${product.id}`} className="group flex flex-col">
      <div className="relative bg-white aspect-[3/4] overflow-hidden">
        {ribbonText ? (
          <span
            className={`absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${getRibbonClassName(product.ribbon_color)}`}
          >
            {ribbonText}
          </span>
        ) : (
          badge && (
            <span
              className={`absolute top-2 left-2 z-10 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide ${BADGE_STYLES[badge] || "bg-gray-200 text-gray-800"}`}
            >
              {badge}
            </span>
          )
        )}
        {image ? (
          <>
            <Image
              src={image}
              alt={name}
              fill
              className={
                hoverImage
                  ? "object-contain p-3 transition-opacity duration-300 group-hover:opacity-0"
                  : "object-contain p-3 group-hover:scale-105 transition-transform duration-300"
              }
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
            />
            {hoverImage && (
              <Image
                src={hoverImage}
                alt={name}
                fill
                className="object-contain p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
          </div>
        )}
      </div>

      <div className="pt-3 pb-1 flex-1 flex flex-col">
        <p className="text-xs text-gray-500 mb-0.5">{product.Marca || ""}</p>
        <h3 className="text-sm text-gray-900 leading-snug line-clamp-2 flex-1">{name}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          {originalPrice != null && (
            <span className="text-xs text-gray-400 line-through">{formatPrice(originalPrice)}</span>
          )}
          <span className={`text-sm font-medium ${originalPrice != null ? "text-red-600" : "text-brand"}`}>
            {formatPrice(price)}
          </span>
          <span className="text-xs text-gray-500">/ day</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">Excluding taxes and fees</p>
      </div>

      <span className="mt-2 block w-full text-center bg-black text-white text-xs py-2.5 font-medium group-hover:bg-brand transition-colors">
        View Vehicle
      </span>
    </Link>
  );
}
