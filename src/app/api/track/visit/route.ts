import { NextRequest, NextResponse } from "next/server";
import { notifyNewVisit } from "@/lib/notify";

export const maxDuration = 10;

// Intentionally public (no requireAdmin) — called by anonymous store visitors from
// VisitTracker.tsx once per browser session. Never throws back to the client; a
// failed/misconfigured notification must not surface as an error on the storefront.
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  let path = "/";
  try {
    const body = (await request.json()) as { path?: string };
    if (typeof body.path === "string" && body.path.length > 0) path = body.path.slice(0, 300);
  } catch {
    // no/invalid body — fall back to "/"
  }

  const city = request.headers.get("x-vercel-ip-city");
  const region = request.headers.get("x-vercel-ip-country-region");
  const country = request.headers.get("x-vercel-ip-country");

  try {
    await notifyNewVisit({
      path,
      origin,
      city: city ? decodeURIComponent(city) : null,
      region,
      country,
    });
  } catch {
    // never fail the request over a notification error
  }

  return NextResponse.json({ ok: true });
}
