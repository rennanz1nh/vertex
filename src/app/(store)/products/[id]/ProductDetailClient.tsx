"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { type Product } from "@/lib/supabase";
import { saveTripDraft, tripDays, type TripDraft } from "@/lib/tripDraft";
import { formatPrice } from "@/lib/utils";
import { getEffectivePrice } from "@/lib/pricing";
import { getProductImage } from "@/lib/product-images";
import { isVideoUrl } from "@/lib/media-url";
import Link from "next/link";
import { ChevronLeft, Play } from "lucide-react";

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function formatUsDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function ProductDetailClient({ product }: { product: Product }) {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [pickupDate, setPickupDate] = useState(defaultDate(1));
  const [pickupTime, setPickupTime] = useState("10:00");
  const [returnDate, setReturnDate] = useState(defaultDate(4));
  const [returnTime, setReturnTime] = useState("10:00");
  const [dateError, setDateError] = useState<string | null>(null);

  const name = product["Produto Nome"] || "Vehicle";
  const { price: dailyRate, originalPrice } = getEffectivePrice(
    product["Valor de venda (Online)"],
    product.sale_price
  );
  const description = product["Informacoes dos produtos / descricao"] || "";
  const cover = product.image_url || getProductImage(name);
  const details = (Array.isArray(product.details) ? product.details : []).filter(
    (d) => d && d.label && d.value
  );
  const galleryUrls = Array.isArray(product.gallery_urls) ? product.gallery_urls : [];
  const images = [...new Set([cover, ...galleryUrls].filter(Boolean))] as string[];
  const imageSrc = selectedImage && images.includes(selectedImage) ? selectedImage : cover;

  const days = useMemo(() => {
    if (!pickupDate || !returnDate) return 0;
    return tripDays({ pickupDate, returnDate });
  }, [pickupDate, returnDate]);
  const subtotal = dailyRate * days;

  function handleContinue() {
    setDateError(null);
    const pickup = new Date(`${pickupDate}T${pickupTime}`);
    const ret = new Date(`${returnDate}T${returnTime}`);
    if (ret.getTime() <= pickup.getTime()) {
      setDateError("Trip end must be after trip start.");
      return;
    }

    const draft: TripDraft = {
      carId: product.id,
      carName: name,
      carImage: imageSrc,
      dailyRate,
      pickupDate,
      pickupTime,
      returnDate,
      returnTime,
      protectionPlan: null,
      extras: [],
      driver: null,
    };
    saveTripDraft(draft);
    router.push("/cart");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-black mb-6"
      >
        <ChevronLeft size={16} /> Back to vehicles
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
          {product.Marca && <p className="text-sm text-gray-500 mb-1">{product.Marca}</p>}
          <h1 className="font-serif text-2xl md:text-3xl font-normal text-gray-900 leading-snug mb-4">
            {name}
          </h1>

          <div className="flex items-baseline gap-3 mb-1">
            {originalPrice != null && (
              <span className="text-base text-gray-400 line-through">{formatPrice(originalPrice)}</span>
            )}
            <span className={`text-xl font-semibold ${originalPrice != null ? "text-red-600" : "text-brand"}`}>
              {formatPrice(dailyRate)}
            </span>
            <span className="text-sm text-gray-500">/ day</span>
          </div>
          <p className="text-xs text-gray-400 mb-6">Excluding taxes and fees</p>

          {description && (
            <p className="text-sm text-gray-600 leading-relaxed mb-6">{description}</p>
          )}

          {details.length > 0 && (
            <div className="mb-6 divide-y divide-gray-100 border-t border-gray-100">
              {details.map((d, i) => (
                <div key={i} className="py-3">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{d.label}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{d.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Trip dates */}
          <div className="mt-auto pt-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-900 mb-3">Trip dates</p>

            <div className="grid grid-cols-2 gap-3 mb-1">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Trip start</label>
                <input
                  type="date"
                  lang="en-US"
                  value={pickupDate}
                  min={defaultDate(0)}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-2 text-sm"
                />
                <input
                  type="time"
                  lang="en-US"
                  value={pickupTime}
                  onChange={(e) => setPickupTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-2 text-sm mt-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Trip end</label>
                <input
                  type="date"
                  lang="en-US"
                  value={returnDate}
                  min={pickupDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-2 text-sm"
                />
                <input
                  type="time"
                  lang="en-US"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-sm px-2 py-2 text-sm mt-2"
                />
              </div>
            </div>

            {pickupDate && returnDate && (
              <p className="text-xs text-gray-500 mb-3">
                {formatUsDate(pickupDate)} at {pickupTime} &rarr; {formatUsDate(returnDate)} at {returnTime}
              </p>
            )}

            {dateError && <p className="text-xs text-red-600 mb-3">{dateError}</p>}

            {days > 0 && (
              <div className="flex justify-between text-sm text-gray-700 mb-4">
                <span>
                  {formatPrice(dailyRate)} &times; {days} day{days > 1 ? "s" : ""}
                </span>
                <span className="font-semibold">{formatPrice(subtotal)}</span>
              </div>
            )}

            <button
              onClick={handleContinue}
              className="w-full bg-black text-white py-3 text-sm font-medium hover:bg-brand transition-colors"
            >
              Continue
            </button>
            <p className="text-[11px] text-gray-400 mt-2 text-center">
              You won&apos;t be charged yet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
