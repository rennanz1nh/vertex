"use client";

import { useState } from "react";
import Image from "next/image";
import { type Product } from "@/lib/supabase";
import { addToCart } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { getProductImage } from "@/lib/product-images";
import { isVideoUrl } from "@/lib/media-url";
import Link from "next/link";
import { ChevronLeft, Minus, Plus, Play } from "lucide-react";

export default function ProductDetailClient({ product }: { product: Product }) {
  const [added, setAdded] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const name = product["Produto Nome"] || "Product";
  const { price, originalPrice } = getEffectivePrice(product["Valor de venda (Online)"], product.sale_price);
  const description = product["Informacoes dos produtos / descricao"] || "";
  const stock = parseInt(product["Quantidade no Estoque"] || "0");
  const cover = product.image_url || getProductImage(name);
  const details = (Array.isArray(product.details) ? product.details : []).filter(
    (d) => d && d.label && d.value
  );
  const galleryUrls = Array.isArray(product.gallery_urls) ? product.gallery_urls : [];
  // cover first, then extra photos (deduped)
  const images = [...new Set([cover, ...galleryUrls].filter(Boolean))] as string[];
  const imageSrc = selectedImage && images.includes(selectedImage) ? selectedImage : cover;

  function handleAddToCart() {
    addToCart({ id: product.id, name, price, image_url: imageSrc }, quantity);
    setAdded(true);
    setQuantity(1);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-6"
      >
        <ChevronLeft size={16} /> Back to products
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16">
        {/* Images: main + thumbnails */}
        <div>
          <div className="bg-white aspect-square relative rounded-sm overflow-hidden">
            {imageSrc && isVideoUrl(imageSrc) ? (
              <video
                key={imageSrc}
                src={imageSrc}
                className="w-full h-full object-contain p-8"
                controls
                autoPlay
                muted
                loop
                playsInline
              />
            ) : imageSrc ? (
              <Image
                src={imageSrc}
                alt={name}
                fill
                className="object-contain p-8"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                </svg>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-2 flex-wrap">
              {images.map((img) => (
                <button
                  key={img}
                  onClick={() => setSelectedImage(img)}
                  className={`relative w-16 h-16 bg-white rounded-sm overflow-hidden border-2 transition-colors ${
                    img === imageSrc ? "border-black" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  {isVideoUrl(img) ? (
                    <>
                      <video src={img} className="w-full h-full object-cover" muted />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Play className="h-5 w-5 text-white drop-shadow" fill="white" />
                      </span>
                    </>
                  ) : (
                    <Image src={img} alt="" fill className="object-contain p-1" sizes="64px" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {product.Marca && (
            <p className="text-sm text-gray-500 mb-1">{product.Marca}</p>
          )}
          <h1 className="font-serif text-2xl md:text-3xl font-normal text-gray-900 leading-snug mb-4">
            {name}
          </h1>

          <div className="flex items-baseline gap-3 mb-1">
            {originalPrice != null && (
              <span className="text-base text-gray-400 line-through">{formatPrice(originalPrice)}</span>
            )}
            <span className={`text-xl font-semibold ${originalPrice != null ? "text-red-600" : "text-brand"}`}>
              {formatPrice(price)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-6">Excluding Sales Tax</p>

          {description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-6">{description}</p>
          )}

          {details.length > 0 && (
            <div className="mb-6 divide-y divide-gray-100 border-t border-gray-100">
              {details.map((d, i) => (
                <div key={i} className="py-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{d.label}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                    {d.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {product.Volume && (
            <p className="text-sm text-gray-500 mb-1">
              <span className="font-medium text-gray-700">Volume:</span> {product.Volume}
            </p>
          )}
          {product.SKU && (
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-medium text-gray-700">SKU:</span> {product.SKU}
            </p>
          )}

          <div className="mt-auto pt-4">
            {stock > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Quantity</p>
                <div className="inline-flex items-center border border-gray-300 rounded-sm">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center text-sm font-medium text-gray-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                    className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    disabled={quantity >= stock}
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            )}

            {stock <= 0 ? (
              <button
                disabled
                className="w-full bg-gray-200 text-gray-400 py-3 text-sm font-medium cursor-not-allowed"
              >
                Out of Stock
              </button>
            ) : (
              <button
                onClick={handleAddToCart}
                className="w-full bg-black text-white py-3 text-sm font-medium hover:bg-brand transition-colors"
              >
                {added ? "Added to Cart!" : "Add to Cart"}
              </button>
            )}
            <Link
              href="/cart"
              className="block text-center mt-3 text-sm text-gray-600 hover:text-black underline"
            >
              View Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
