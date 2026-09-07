import { NextRequest, NextResponse } from "next/server";
import { fetchAllActiveListings } from "@/lib/amazon-price-update";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const listings = await fetchAllActiveListings();
    return NextResponse.json({ listings });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
