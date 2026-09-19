/**
 * Parse a date string (typically YYYY-MM-DD from Postgres `date` columns) as a
 * local-midnight Date, avoiding the UTC timezone shift caused by `new Date(str)`.
 */
export function parseLocalDate(s: string | Date | null | undefined): Date {
  if (!s) return new Date(NaN);
  if (s instanceof Date) return s;
  const str = String(s);
  // Support "YYYY-MM-DD" and "YYYY-MM-DDTHH:..." — only the date portion matters
  const [datePart] = str.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return new Date(str);
  return new Date(y, m - 1, d);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * "July,27" for dates in the current year, "July,27 (2025)" otherwise — shared date
 * column format across Pedidos, Clientes and Shipping's.
 */
export function formatShortDate(date: Date): string {
  if (isNaN(date.getTime())) return "-";
  const month = MONTH_NAMES[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  return year === currentYear ? `${month},${day}` : `${month},${day} (${year})`;
}

/** "Fri, Sep 25, 2026" — shared long-form date used across the booking flow and the
 *  Reservas admin pages (checkout, BookingModal, the Rental Agreement PDF). */
export function formatUsDate(iso: string): string {
  if (!iso) return "";
  return parseLocalDate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
