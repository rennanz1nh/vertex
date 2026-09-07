export type Carrier = 'USPS' | 'UPS' | 'FedEx' | 'DHL';

/** Normalize carrier names from eBay API codes or free-text to canonical short names */
export function normalizeCarrierName(carrier: string | null | undefined): string | null {
  if (!carrier) return null;
  const c = carrier.toUpperCase();
  if (c.startsWith('USPS') || c.includes('POSTAL') || c.includes('FIRST_CLASS') || c.includes('GROUND_ADVANTAGE') || c.includes('PRIORITY_MAIL')) return 'USPS';
  if (c.startsWith('UPS')) return 'UPS';
  if (c.startsWith('FEDEX') || c.startsWith('FED_EX') || c === 'FEDEX') return 'FedEx';
  if (c.startsWith('DHL')) return 'DHL';
  // Free-text fallbacks (from CSV or manual entry)
  if (c.includes('UPS')) return 'UPS';
  if (c.includes('USPS') || c.includes('POSTAL') || c.includes('FIRST CLASS')) return 'USPS';
  if (c.includes('FEDEX') || c.includes('FED EX')) return 'FedEx';
  if (c.includes('DHL')) return 'DHL';
  return carrier;
}

/**
 * Detect carrier from tracking number pattern.
 * Returns null when the pattern is not conclusive (better than guessing wrong).
 *
 * UPS:   starts with "1Z" (always — very reliable)
 * USPS:  starts with 92/93/94/95/96/97 + 18-22 digits, OR 20-22 pure digits
 * FedEx: exactly 12 or 15 digits
 */
export function detectCarrier(trackingNumber: string): Carrier | null {
  if (!trackingNumber) return null;
  const num = trackingNumber.trim().replace(/\s/g, '');
  const upper = num.toUpperCase();

  // UPS — starts with "1Z" (extremely reliable signal)
  if (upper.startsWith('1Z')) return 'UPS';

  // USPS — GS1-128 barcodes: start with 92/93/94/95/96/97, 20–22 digits total
  if (/^(92|93|94|95|96|97|420)\d{14,}$/.test(num)) return 'USPS';

  // USPS — plain 20–22 digit strings
  if (/^\d{20,22}$/.test(num)) return 'USPS';

  // FedEx — exactly 12 or 15 digits
  if (/^\d{12}$/.test(num) || /^\d{15}$/.test(num)) return 'FedEx';

  // Cannot determine confidently — let caller fall back to stored carrier
  return null;
}

/**
 * Returns the logo path for a carrier.
 * Priority: tracking number pattern > stored carrier name.
 */
export function getCarrierLogo(
  carrier: Carrier | string | null,
  trackingNumber?: string | null,
): string | null {
  const detected = trackingNumber ? detectCarrier(trackingNumber) : null;
  const resolved = detected ?? normalizeCarrierName(carrier);
  switch (resolved?.toUpperCase()) {
    case 'USPS':  return '/images/carriers/usps.jpg';
    case 'UPS':   return '/images/carriers/ups.jpg';
    case 'FEDEX': return '/images/carriers/Fedex.jpg';
    case 'DHL':   return '/images/carriers/dhl.jpg';
    default:      return null;
  }
}

/**
 * Returns the tracking URL.
 * Priority: tracking number pattern > stored carrier name.
 */
export function getTrackingUrl(
  trackingNumber: string,
  carrier?: Carrier | string | null,
): string {
  const num = trackingNumber.trim();
  const detected = detectCarrier(num);
  const c = detected ?? normalizeCarrierName(carrier) ?? 'USPS';
  switch (c) {
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${encodeURIComponent(num)}`;
    case 'FedEx':
      return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(num)}`;
    case 'DHL':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(num)}`;
    case 'USPS':
    default:
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(num)}`;
  }
}

export const CARRIER_OPTIONS: Carrier[] = ['USPS', 'UPS', 'FedEx', 'DHL'];

/** Brand-recognizable accent color per carrier — used as a stripe/tint, not for text contrast. */
export const CARRIER_ACCENT: Record<Carrier, string> = {
  USPS: '#1d4ed8',
  UPS: '#78350f',
  FedEx: '#5b21b6',
  DHL: '#dc2626',
};
