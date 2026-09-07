import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getGoogleShoppingConnection } from "@/lib/google-shopping-auth";

/**
 * Diagnostic route: returns the Merchant API's raw products.list response, untouched by
 * our own parsing, so the real productStatus shape (destinationStatuses, itemLevelIssues)
 * can be inspected against the live account.
 *
 * The Content API's old standalone `productstatuses` service doesn't exist in the
 * Merchant API — calling that shape (`/productStatuses`) 404s with Google's generic web
 * error page (not a JSON API error), because the route isn't registered at all. Status
 * now comes back embedded in each Product resource from products.list — see
 * fetchProductStatuses() in src/lib/google-shopping-feed.ts for the parsed version.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const { accessToken, merchantId } = await getGoogleShoppingConnection();
    const res = await fetch(
      `https://merchantapi.googleapis.com/products/v1/accounts/${merchantId}/products?pageSize=3`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const body = await res.json();
    return NextResponse.json({ httpStatus: res.status, body });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
