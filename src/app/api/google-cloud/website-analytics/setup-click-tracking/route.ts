import { NextRequest, NextResponse } from "next/server";
import { ensureButtonClickCustomDimension } from "@/lib/google-analytics-admin-api";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  try {
    const result = await ensureButtonClickCustomDimension();
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
