// Shared date/time helpers for eBay Marketing API calls that require full ISO 8601
// timestamps with a UTC offset (e.g. "2026-08-01T00:00:00-07:00") rather than bare
// "YYYY-MM-DD" dates — sending bare dates to ad_report_task's dateFrom/dateTo was the
// confirmed cause of its generic 35001 "internal system or process" error, and the
// campaign resource's own startDate/endDate fields (seen in real API responses, e.g.
// "2025-08-09T01:40:30.000Z") are full timestamps too, so anywhere this app sends a date
// to eBay's Marketing API should go through here rather than a bare date string.

/** The UTC offset (whole hours, e.g. -8 or -7) America/Los_Angeles observes on the given
 *  calendar day — needed because that offset flips with US daylight saving time. */
export function losAngelesUtcOffsetHours(dateStr: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  }).formatToParts(new Date(`${dateStr}T12:00:00Z`));
  const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT-8";
  const match = tzName.match(/GMT([+-]\d+)/);
  return match ? parseInt(match[1], 10) : -8;
}

/** Midnight (or end-of-day) for the given "YYYY-MM-DD" day, expressed in the marketplace's
 *  own Pacific offset — keeps eBay-facing timestamps aligned with the same US-marketplace
 *  calendar day the rest of this app's date ranges (report-periods.ts) already use. */
export function marketplaceTimestamp(dateStr: string, endOfDay: boolean): string {
  const offset = losAngelesUtcOffsetHours(dateStr);
  const sign = offset <= 0 ? "-" : "+";
  const hh = String(Math.abs(offset)).padStart(2, "0");
  const time = endOfDay ? "23:59:59" : "00:00:00";
  return `${dateStr}T${time}${sign}${hh}:00`;
}
