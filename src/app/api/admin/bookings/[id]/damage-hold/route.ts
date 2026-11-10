import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { chargeDamage, markReturned, placeHold, releaseHold } from "@/lib/damage-hold";

type Body =
  | { action: "returned" }
  | { action: "charge"; amount: number; note?: string }
  | { action: "release" }
  | { action: "retry" };

// The admin buttons on the $99 damage deposit (Reservas → "Caução"):
//   returned  "Carro devolvido": starts the 3-day countdown; the cron releases the hold after.
//   charge    "Cobrar dano": captures up to the held amount (or charges the saved card if no
//             hold could be placed).
//   release   "Liberar agora": releases the hold without waiting the 3 days.
//   retry     "Tentar de novo": places a declined hold again right away.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Partial<Body>;

  switch (body.action) {
    case "returned": {
      const r = await markReturned(id);
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    case "charge": {
      const { amount, note } = body as { amount?: unknown; note?: unknown };
      const r = await chargeDamage(id, Number(amount), typeof note === "string" ? note : "");
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    case "release": {
      const r = await releaseHold(id, { force: true });
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    case "retry": {
      const r = await placeHold(id, { force: true });
      return NextResponse.json(r, { status: r.ok ? 200 : 409 });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
