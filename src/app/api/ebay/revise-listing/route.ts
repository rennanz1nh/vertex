import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { reviseListing, type ReviseListingInput } from "@/lib/ebay-revise-listing";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const input = (await request.json()) as ReviseListingInput;

  if (!input.itemId || !input.title || !input.description) {
    return NextResponse.json({ error: "itemId, title e description são obrigatórios" }, { status: 400 });
  }

  try {
    const result = await reviseListing(input);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("eBay token not found") || message.includes("reconnect") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
