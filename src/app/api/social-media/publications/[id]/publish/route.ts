import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { publishPublication } from "@/lib/social-media/publish-service";

export const dynamic = "force-dynamic";
// See src/app/api/mcp/route.ts for why this needs more than the default budget.
export const maxDuration = 300;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  try {
    const result = await publishPublication(id, { source: "hub_ui", userId: auth.userId });
    if (result.outcome === "failed") {
      return NextResponse.json({ error: result.errorMessage, publication: result.publication }, { status: 502 });
    }
    return NextResponse.json({ outcome: result.outcome, publication: result.publication });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to publish" }, { status: 500 });
  }
}
