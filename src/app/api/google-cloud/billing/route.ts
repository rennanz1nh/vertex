import { NextRequest, NextResponse } from "next/server";
import { getProjectBillingInfo, listBudgets } from "@/lib/google-billing";
import { requireAdmin } from "@/lib/admin-auth";

// Billing account name + configured budget amounts — sensitive account detail, checked
// server-side (see admin-auth.ts's own doc comment on why most admin routes don't).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  let billingError: string | null = null;
  let budgetsError: string | null = null;

  const billing = await getProjectBillingInfo().catch((e: unknown) => {
    billingError = e instanceof Error ? e.message : String(e);
    return null;
  });
  const budgets = await listBudgets().catch((e: unknown) => {
    budgetsError = e instanceof Error ? e.message : String(e);
    return [];
  });

  return NextResponse.json({ billing, billingError, budgets, budgetsError });
}
