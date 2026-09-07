import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { listBigQueryLinks, getPropertyInfo } from "@/lib/google-analytics-admin-api";
import { getGa4PropertyId, saveGa4PropertyId } from "@/lib/google-cloud-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const propertyId = await getGa4PropertyId();
  if (!propertyId) {
    return NextResponse.json({ configured: false, propertyId: null, property: null, links: [] });
  }

  try {
    const [property, links] = await Promise.all([getPropertyInfo(), listBigQueryLinks()]);
    return NextResponse.json({ configured: true, propertyId, property, links, error: null });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ configured: true, propertyId, property: null, links: [], error: message });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { propertyId } = await request.json();
  if (typeof propertyId !== "string" || !propertyId.trim()) {
    return NextResponse.json({ error: "propertyId é obrigatório" }, { status: 400 });
  }
  await saveGa4PropertyId(propertyId.trim());
  return NextResponse.json({ propertyId: propertyId.trim() });
}
