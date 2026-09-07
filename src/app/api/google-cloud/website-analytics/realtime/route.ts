import { NextRequest, NextResponse } from "next/server";
import { runRealtimeActiveUsers } from "@/lib/google-analytics-data-api";
import { requireAdmin } from "@/lib/admin-auth";

export const maxDuration = 15;

// Polled every ~20s from the "Agora no site" widget — kept separate from the main
// /website-analytics route so the period (7/30 day) report and the live count don't
// have to refresh together.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  try {
    const snapshot = await runRealtimeActiveUsers();
    return NextResponse.json(snapshot);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const status = message.includes("não configurado") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
