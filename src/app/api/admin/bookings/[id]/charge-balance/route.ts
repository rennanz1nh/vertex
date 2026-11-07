import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { chargeBalance } from "@/lib/booking-payments";

// Admin "Cobrar saldo agora": charges the remaining balance to the saved card right away,
// regardless of the due date (same off-session charge the cron makes).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const { id } = await params;
  const result = await chargeBalance(id, { force: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
