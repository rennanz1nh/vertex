"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, Plus, Minus, Trash2 } from "lucide-react";
import { getCart, updateQuantity, removeFromCart, getCartTotal, type CartItem } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";

export default function CartDrawer() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const refresh = () => setItems(getCart());
    const openDrawer = () => setOpen(true);
    refresh();
    window.addEventListener("cart-updated", refresh);
    window.addEventListener("cart-drawer-open", openDrawer);
    return () => {
      window.removeEventListener("cart-updated", refresh);
      window.removeEventListener("cart-drawer-open", openDrawer);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const total = getCartTotal(items);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white z-[70] shadow-xl transition-transform duration-300 ease-out flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900 tracking-wide">
            Your Cart{items.length > 0 ? ` (${items.length})` : ""}
          </h2>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-black" aria-label="Close cart">
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <p className="text-sm text-gray-500 mb-6">Your cart is empty.</p>
            <button
              onClick={() => setOpen(false)}
              className="bg-black text-white px-6 py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 py-5">
                  <div className="w-24 h-24 bg-white shrink-0 relative">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.name} fill className="object-contain p-2" sizes="96px" />
                    ) : (
                      <div className="w-full h-full bg-gray-100" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.id}`}
                      onClick={() => setOpen(false)}
                      className="text-sm font-medium text-gray-900 hover:underline line-clamp-2"
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
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                    <p className="text-sm font-semibold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 px-5 py-5">
              <div className="flex justify-between text-sm font-semibold text-gray-900 mb-4">
                <span>Subtotal</span>
                <span>{formatPrice(total)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mb-4 text-center">
                Shipping and taxes calculated at checkout
              </p>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="block w-full bg-black text-white text-sm font-medium py-3 text-center hover:bg-brand transition-colors"
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                onClick={() => setOpen(false)}
                className="block w-full text-center text-sm text-gray-500 hover:text-black mt-3 underline"
              >
                View Cart
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
