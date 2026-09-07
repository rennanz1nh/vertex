// Facebook Pixel event tracking utility
// Calls fbq() if available (only in production when pixel is configured)

export type PixelEventData = {
  content_name?: string;
  content_ids?: string[];
  content_type?: string;
  currency?: string;
  value?: number;
  content_category?: string;
  num_items?: number;
  search_string?: string;
};

function getFbq() {
  if (typeof window !== "undefined" && (window as any).fbq) {
    return (window as any).fbq;
  }
  return null;
}

export function trackPixelEvent(eventName: string, data?: PixelEventData) {
  const fbq = getFbq();
  if (!fbq) return;

  try {
    fbq("track", eventName, data || {});
  } catch (e) {
    console.warn(`Failed to track pixel event: ${eventName}`, e);
  }
}

export function trackViewContent(productName: string, productId: string, price: number, category?: string) {
  trackPixelEvent("ViewContent", {
    content_name: productName,
    content_ids: [productId],
    content_type: "product",
    currency: "USD",
    value: price,
    content_category: category,
  });
}

export function trackAddToCart(productName: string, productId: string, price: number, quantity: number = 1) {
  trackPixelEvent("AddToCart", {
    content_name: productName,
    content_ids: [productId],
    content_type: "product",
    currency: "USD",
    value: price * quantity,
    num_items: quantity,
  });
}

export function trackInitiateCheckout(cartValue: number, itemCount: number) {
  trackPixelEvent("InitiateCheckout", {
    content_type: "product",
    currency: "USD",
    value: cartValue,
    num_items: itemCount,
  });
}

export function trackPurchase(orderTotal: number, itemCount: number, orderId?: string) {
  trackPixelEvent("Purchase", {
    content_type: "product",
    currency: "USD",
    value: orderTotal,
    num_items: itemCount,
    content_ids: orderId ? [orderId] : undefined,
  });
}

export function trackSearch(searchQuery: string) {
  trackPixelEvent("Search", {
    search_string: searchQuery,
  });
}
