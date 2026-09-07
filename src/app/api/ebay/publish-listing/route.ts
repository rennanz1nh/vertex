import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { verifyPublishListing, publishListing, type PublishListingInput } from "@/lib/ebay-publish-listing";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { dryRun, ...input } = body as PublishListingInput & { dryRun: boolean };

  if (!input.title || !input.description) {
    return NextResponse.json({ error: "title e description são obrigatórios" }, { status: 400 });
  }

  try {
    const result = dryRun ? await verifyPublishListing(input) : await publishListing(input);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
