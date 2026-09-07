import { NextRequest, NextResponse } from "next/server";
import { queryDailyPurchases } from "@/lib/google-bigquery";
import { requireAdmin } from "@/lib/admin-auth";

export const maxDuration = 30;

// Real purchase/revenue numbers — sensitive business data, checked server-side (see
// admin-auth.ts's own doc comment on why most admin routes don't).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  const daysParam = request.nextUrl.searchParams.get("days");
  const days = daysParam === "7" || daysParam === "30" ? Number(daysParam) : 7;

  try {
    const rows = await queryDailyPurchases(days);
    return NextResponse.json({ rows });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("não configurado") || message.includes("Nenhum link") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
