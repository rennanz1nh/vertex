"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getProductImage } from "@/lib/product-images";
import { formatPrice } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import type { Product } from "@/lib/supabase";

const SCROLL_AMOUNT = 720;

export default function ClearanceCarousel({ products }: { products: Product[] }) {
  if (!products.length) return null;

  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    scrollRef.current?.scrollBy({
      left: dir === "right" ? SCROLL_AMOUNT : -SCROLL_AMOUNT,
      behavior: "smooth",
    });
  }

  return (
    <section className="border-t border-gray-100 py-10">
      <h2 className="font-display text-2xl md:text-3xl font-normal text-gray-900 text-center mb-6">
        Clearance and deals
      </h2>

      <div className="relative max-w-[1600px] mx-auto px-4">
        {/* Left arrow */}
        <button
          onClick={() => scroll("left")}
          aria-label="Previous"
          className="absolute left-4 top-[45%] -translate-y-1/2 z-10 bg-white border border-gray-200 shadow-md rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-700" />
        </button>

        {/* Scrollable track */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-3 px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {products.map((p) => {
            const name = p["Produto Nome"] || "Product";
            const img = p.image_url || getProductImage(name);
            const { price, originalPrice } = getEffectivePrice(p["Valor de venda (Online)"], p.sale_price);
            return (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="w-[220px] shrink-0 group"
              >
                <div className="relative bg-white aspect-[3/4] overflow-hidden">
                  {img && (
                    <Image
                      src={img}
                      alt={name}
                      fill
                      className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      sizes="220px"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-800 line-clamp-2 mt-2 leading-snug">{name}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  {originalPrice != null && (
                    <span className="text-xs text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                  )}
                  <span className={`text-sm font-medium ${originalPrice != null ? "text-red-600" : "text-brand"}`}>
                    {formatPrice(price)}
                  </span>
                </p>
              </Link>
            );
          })}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll("right")}
          aria-label="Next"
          className="absolute right-4 top-[45%] -translate-y-1/2 z-10 bg-white border border-gray-200 shadow-md rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ChevronRight size={20} className="text-gray-700" />
        </button>
      </div>
    </section>
  );
}
