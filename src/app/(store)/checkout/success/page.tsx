import Link from "next/link";
import Image from "next/image";
import { stripe } from "@/lib/stripe";
import { formatPrice } from "@/lib/utils";
import ClearCart from "./ClearCart";
import TrackPurchase from "./TrackPurchase";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  let session = null;
  if (session_id) {
    try {
      session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["line_items", "line_items.data.price.product"],
      });
    } catch {
      // invalid session_id — show generic thank-you
    }
  }

  const customerName = session?.customer_details?.name || "Customer";
  const orderNumber = session_id ? session_id.replace("cs_", "").slice(-8).toUpperCase() : null;
  const lineItems = (session?.line_items?.data ?? []) as Array<{
    id: string;
    description: string | null;
    quantity: number | null;
    amount_total: number;
    price: {
      unit_amount: number | null;
      product: { name: string; images: string[] } | null;
    } | null;
  }>;

  const subtotal = session?.amount_subtotal ? session.amount_subtotal / 100 : null;
  const total = session?.amount_total ? session.amount_total / 100 : null;
  const shippingCost = session?.shipping_cost
    ? (session.shipping_cost as { amount_total: number }).amount_total / 100
    : 0;

  const shippingAddr = session?.shipping_details;
  const billingAddr = session?.customer_details;

  function formatAddress(
    addr: { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null } | null | undefined,
    name?: string | null
  ) {
    if (!addr) return null;
    return [
      name,
      addr.line1,
      addr.line2,
      [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
      addr.country,
    ].filter(Boolean);
  }

  const deliveryLines = formatAddress(shippingAddr?.address, shippingAddr?.name);
  const billingLines = formatAddress(billingAddr?.address, billingAddr?.name);

  return (
    <>
      <ClearCart />
      <TrackPurchase total={total ?? 0} itemCount={lineItems.length} orderId={orderNumber ?? undefined} />
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-serif text-3xl font-normal text-gray-900 mb-2">
              Thank you, {customerName}
            </h1>
            <p className="text-sm text-gray-500 mb-1">
              You&apos;ll receive a confirmation email soon.
            </p>
            {orderNumber && (
              <p className="text-sm text-gray-400">
                Order number:{" "}
                <span className="font-medium text-gray-600">{orderNumber}</span>
              </p>
            )}
          </div>

          {/* Order card */}
          {lineItems.length > 0 && (
            <div className="bg-white border border-gray-200 mb-4">
              {/* Items */}
              <div className="p-6 space-y-5">
                {lineItems.map((item) => {
                  const product = item.price?.product;
                  const image = product?.images?.[0];
                  const name = product?.name ?? item.description ?? "Product";
                  const qty = item.quantity ?? 1;
                  const unitPrice = item.price?.unit_amount ? item.price.unit_amount / 100 : null;

                  return (
                    <div key={item.id} className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-white border border-gray-100 shrink-0 relative overflow-hidden">
                        {image ? (
                          <Image
                            src={image}
                            alt={name}
                            fill
                            className="object-contain p-1"
                            sizes="64px"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{name}</p>
                        {unitPrice !== null && (
                          <p className="text-sm text-gray-400 mt-0.5">{formatPrice(unitPrice)}</p>
                        )}
                      </div>

                      <p className="text-sm text-gray-500 shrink-0">
                        Qty:{" "}
                        <span className="font-semibold text-gray-900">{qty}</span>
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 mx-6" />

              {/* Totals */}
              <div className="p-6 flex justify-end">
                <div className="w-52 space-y-2 text-sm">
                  {subtotal !== null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="text-gray-900">{formatPrice(subtotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivery</span>
                    <span className="text-gray-900">
                      {shippingCost > 0 ? formatPrice(shippingCost) : "Free"}
                    </span>
                  </div>
                  {total !== null && (
                    <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-gray-900">{formatPrice(total)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Addresses */}
          {(deliveryLines || billingLines) && (
            <div className="bg-white border border-gray-200 mb-8 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
              {deliveryLines && (
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Delivery address
                  </p>
                  <div className="text-sm text-gray-700 space-y-0.5">
                    {deliveryLines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    {billingAddr?.phone && (
                      <p className="text-gray-500 mt-1">{billingAddr.phone}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">3–5 Business Days</p>
                </div>
              )}
              {billingLines && (
                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                    Billing address
                  </p>
                  <div className="text-sm text-gray-700 space-y-0.5">
                    {billingLines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                    {billingAddr?.phone && (
                      <p className="text-gray-500 mt-1">{billingAddr.phone}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="text-center">
            <Link
              href="/products"
              className="inline-block bg-black text-white px-8 py-3 text-sm font-medium hover:bg-brand transition-colors"
            >
              Continue Browsing
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
