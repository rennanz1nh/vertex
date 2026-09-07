"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getCart, getCartTotal, type CartItem } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";
import { trackInitiateCheckout } from "@/lib/facebook-pixel-events";

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(getCart());
  }, []);

  const total = getCartTotal(items);

  useEffect(() => {
    if (items.length === 0) return;
    trackInitiateCheckout(
      total,
      items.reduce((sum, item) => sum + item.quantity, 0)
    );
  }, [items, total]);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Could not start checkout");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-light text-gray-900 mb-3">Your cart is empty</h1>
        <Link
          href="/products"
          className="inline-block bg-black text-white px-8 py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-8">Checkout</h1>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 py-5">
              <div className="w-20 h-20 bg-white shrink-0 relative">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-contain p-2" sizes="80px" />
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {item.quantity} x {formatPrice(item.price)}
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        <div className="lg:w-80 shrink-0">
          <div className="bg-gray-50 p-6 sticky top-24">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-4">
              <span>Shipping &amp; taxes</span>
              <span>Calculated by Stripe</span>
            </div>
            <div className="border-t border-gray-200 pt-4 flex justify-between text-sm font-semibold text-gray-900 mb-6">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>

            {error && <p className="text-xs text-red-500 mb-4">{error}</p>}

            <button
              onClick={handleCheckout}
              disabled={loading}
              className="block w-full bg-black text-white text-sm font-medium py-3 text-center hover:bg-brand transition-colors disabled:opacity-50"
            >
              {loading ? "Redirecting…" : "Pay with Card"}
            </button>
            <Link
              href="/cart"
              className="block w-full text-center text-sm text-gray-500 hover:text-black mt-3 underline"
            >
              Back to Cart
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
