import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabase, STORE_PRODUCTS } from "@/lib/supabase";
import { getEffectivePrice } from "@/lib/pricing";
import { getAbandonedCartDelayHours } from "@/lib/automatic-emails";
import { notifyCheckoutStarted } from "@/lib/notify";

// Every country Stripe Checkout supports for shipping (incl. "ZZ" = Rest of World).
const ALL_COUNTRIES = [
  "AC", "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AT", "AU", "AW", "AX", "AZ",
  "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS",
  "BT", "BV", "BW", "BY", "BZ", "CA", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO",
  "CR", "CV", "CW", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER",
  "ES", "ET", "FI", "FJ", "FK", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL",
  "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HN", "HR", "HT", "HU", "ID",
  "IE", "IL", "IM", "IN", "IO", "IQ", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI",
  "KM", "KN", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV",
  "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MK", "ML", "MM", "MN", "MO", "MQ", "MR", "MS", "MT",
  "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NG", "NI", "NL", "NO", "NP", "NR", "NU",
  "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PY", "QA",
  "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL",
  "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SZ", "TA", "TC", "TD", "TF", "TG", "TH", "TJ",
  "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "US", "UY", "UZ", "VA",
  "VC", "VE", "VG", "VN", "VU", "WF", "WS", "XK", "YE", "YT", "ZA", "ZM", "ZW", "ZZ",
] as const;

// Only `id` and `quantity` are trusted from the client — name/image/price are always
// re-derived from Supabase below. Never build a Stripe line item from client-supplied
// price data; that was previously forgeable (edit localStorage or the raw POST body).
type CheckoutItem = {
  id: string;
  quantity: number;
};

export async function POST(req: NextRequest) {
  const { items } = (await req.json()) as { items: CheckoutItem[] };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;

  const ids = [...new Set(items.map((i) => i.id).filter((id): id is string => typeof id === "string" && id.length > 0))];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // store_products only exposes products the admin has explicitly published to the
  // store (store_visible = true), so this also blocks checking out a hidden/unlisted
  // product by guessing its id.
  const { data: products, error: productsError } = await supabase
    .from(STORE_PRODUCTS)
    .select('id, "Produto Nome", "Valor de venda (Online)", sale_price, image_url')
    .in("id", ids);

  if (productsError) {
    console.error("Failed to load products for checkout:", productsError);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }

  const productById = new Map((products ?? []).map((p) => [p.id, p]));

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  for (const item of items) {
    const product = productById.get(item.id);
    if (!product) continue; // unknown, deleted, or no longer listed in the store — silently dropped
    const quantity = Math.min(99, Math.max(1, Math.floor(Number(item.quantity)) || 1));
    const { price } = getEffectivePrice(product["Valor de venda (Online)"], product.sale_price);
    if (price <= 0) continue; // no usable price on file — don't charge $0
    line_items.push({
      quantity,
      price_data: {
        currency: "usd",
        unit_amount: Math.round(price * 100),
        product_data: {
          name: product["Produto Nome"] || "Product",
          images: product.image_url?.startsWith("http") ? [product.image_url] : undefined,
          metadata: { product_id: product.id },
        },
      },
    });
  }

  if (line_items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  // The abandoned-cart email fires off this session's own expiry (Stripe only tells us
  // "expired", not "abandoned after N hours") — so its delay_hours setting doubles as
  // how soon we give up on this checkout. Clamped to Stripe's own allowed range (30min–24h).
  const abandonedCartDelayHours = await getAbandonedCartDelayHours();
  const expiresAt = Math.floor(Date.now() / 1000) + Math.min(24, Math.max(0.5, abandonedCartDelayHours)) * 3600;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      shipping_address_collection: { allowed_countries: ALL_COUNTRIES as unknown as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] },
      adaptive_pricing: { enabled: true },
      automatic_tax: { enabled: true },
      allow_promotion_codes: true,
      expires_at: Math.round(expiresAt),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
    });

    const total = line_items.reduce((sum, li) => {
      const unitAmount = li.price_data?.unit_amount ?? 0;
      return sum + (unitAmount / 100) * (li.quantity ?? 1);
    }, 0);
    notifyCheckoutStarted({
      total,
      city: req.headers.get("x-vercel-ip-city") ? decodeURIComponent(req.headers.get("x-vercel-ip-city")!) : null,
      region: req.headers.get("x-vercel-ip-country-region"),
      country: req.headers.get("x-vercel-ip-country"),
    }).catch(() => {});

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Failed to create Stripe checkout session:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
