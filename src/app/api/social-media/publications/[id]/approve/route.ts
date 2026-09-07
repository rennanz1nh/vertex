import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { approvePublication } from "@/lib/social-media/publication-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  try {
    const publication = await approvePublication(id, { source: "hub_ui", userId: auth.userId });
    return NextResponse.json({ publication });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to approve publication" }, { status: 500 });
  }
}
