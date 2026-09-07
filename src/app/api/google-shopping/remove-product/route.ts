import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteFromGoogleShopping } from "@/lib/google-shopping-feed";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { sku } = await request.json();
  if (!sku || typeof sku !== "string") {
    return NextResponse.json({ error: "sku é obrigatório" }, { status: 400 });
  }

  try {
    await deleteFromGoogleShopping(sku);
    return NextResponse.json({ removed: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
