import Link from "next/link";

export default function CheckoutCancelPage() {
  return (
    <div className="max-w-[1600px] mx-auto px-4 py-24 text-center">
      <h1 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-3">
        Checkout canceled
      </h1>
      <p className="text-sm text-gray-500 mb-8">Your cart is still saved — nothing was charged.</p>
      <Link
        href="/cart"
        className="inline-block bg-black text-white px-8 py-3 text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        Back to Cart
      </Link>
    </div>
  );
}
