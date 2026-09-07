"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Plus, Minus } from "lucide-react";
import {
  getCart,
  updateQuantity,
  removeFromCart,
  getCartTotal,
  type CartItem,
} from "@/lib/cart";
import { formatPrice } from "@/lib/utils";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const refresh = () => setItems(getCart());
    refresh();
    window.addEventListener("cart-updated", refresh);
    return () => window.removeEventListener("cart-updated", refresh);
  }, []);

  const total = getCartTotal(items);

  if (items.length === 0) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 py-20 text-center">
        <h1 className="font-serif text-2xl font-light text-gray-900 mb-3">Your cart is empty</h1>
        <p className="text-sm text-gray-500 mb-6">Add some products to get started.</p>
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
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-8">
        Shopping Cart
      </h1>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Items */}
        <div className="flex-1 divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 py-5">
              <div className="w-24 h-24 bg-white shrink-0 relative">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    className="object-contain p-2"
                    sizes="96px"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100" />
                )}
              </div>

              <div className="flex-1">
                <Link
                  href={`/products/${item.id}`}
                  className="text-sm font-medium text-gray-900 hover:underline"
                >
                  {item.name}
                </Link>
                <p className="text-sm text-gray-500 mt-1">{formatPrice(item.price)}</p>

                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-sm w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-end justify-between">
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
                <p className="text-sm font-semibold text-gray-900">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:w-72 shrink-0">
          <div className="bg-gray-50 p-6 sticky top-24">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mb-4">
              <span>Shipping</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="border-t border-gray-200 pt-4 flex justify-between text-sm font-semibold text-gray-900 mb-6">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
            <p className="text-[10px] text-gray-400 mb-4 text-center">Excluding Sales Tax</p>
            <Link
              href="/checkout"
              className="block w-full bg-black text-white text-sm font-medium py-3 text-center hover:bg-brand transition-colors"
            >
              Proceed to Checkout
            </Link>
            <Link
              href="/products"
              className="block w-full text-center text-sm text-gray-500 hover:text-black mt-3 underline"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
