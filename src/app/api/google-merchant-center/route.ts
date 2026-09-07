import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  fetchAccountIssues,
  fetchAggregateProductStatuses,
  fetchPromotions,
  type AccountIssue,
  type AggregateProductStatus,
  type Promotion,
} from "@/lib/google-merchant-center";

export const maxDuration = 30;

/**
 * All three Merchant Center dashboard sections in one call, each isolated so one failing
 * section (e.g. an account with no promotions ever configured, or an unexpected 400 on a
 * less-verified endpoint) doesn't blank out the other two — same pattern as the eBay
 * campaign report's per-funding-model isolation.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  let issuesError: string | null = null;
  let statusesError: string | null = null;
  let promotionsError: string | null = null;

  const [issues, statuses, promotions] = await Promise.all([
    fetchAccountIssues().catch((e: unknown): AccountIssue[] => {
      issuesError = e instanceof Error ? e.message : String(e);
      return [];
    }),
    fetchAggregateProductStatuses().catch((e: unknown): AggregateProductStatus[] => {
      statusesError = e instanceof Error ? e.message : String(e);
      return [];
    }),
    fetchPromotions().catch((e: unknown): Promotion[] => {
      promotionsError = e instanceof Error ? e.message : String(e);
      return [];
    }),
  ]);

  // Only the connection itself being missing/unconfigured deserves a 401 for the whole
  // route — the same underlying cause for all three failing at once (getGoogleShoppingConnection
  // throws before any of the three fetches even reach Google).
  if (issuesError && statusesError && promotionsError && issuesError.includes("não conectada")) {
    return NextResponse.json({ error: issuesError }, { status: 401 });
  }

  return NextResponse.json({ issues, issuesError, statuses, statusesError, promotions, promotionsError });
}
