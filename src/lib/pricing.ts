import { parsePrice } from "@/lib/utils";

/**
 * Resolves the price a customer actually pays: the sale price when it's set and lower
 * than the regular price, otherwise the regular price. `originalPrice` is null when
 * there's no active discount, so callers can skip the strikethrough treatment.
 *
 * Used both for storefront display (ProductCard, product detail page) and — critically —
 * server-side in /api/stripe/checkout, which re-derives the charge amount from Supabase
 * instead of trusting whatever price the client sends.
 */
export function getEffectivePrice(
  regularPrice: string | number | null | undefined,
  salePrice: string | number | null | undefined
): { price: number; originalPrice: number | null } {
  const regular = parsePrice(regularPrice ?? null);
  const sale = salePrice != null ? parsePrice(salePrice) : 0;
  if (sale > 0 && sale < regular) {
    return { price: sale, originalPrice: regular };
  }
  return { price: regular, originalPrice: null };
}
