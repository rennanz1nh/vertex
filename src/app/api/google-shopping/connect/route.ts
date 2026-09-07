import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import { getGoogleShoppingConnection, saveDataSource } from "@/lib/google-shopping-auth";
import { ensureDataSource, registerDeveloper } from "@/lib/google-shopping-feed";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

/**
 * No OAuth redirect (eBay) or refresh-token paste (Amazon) here — the seller only
 * supplies the Merchant Center ID. Everything else (service account credentials) lives
 * server-side in GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON, added as a user on that Merchant
 * Center account beforehand (Settings → Account access, outside this app).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { merchantId, developerEmail } = body;

  if (!merchantId || typeof merchantId !== "string") {
    return NextResponse.json({ error: "Merchant Center ID é obrigatório" }, { status: 400 });
  }

  const supabase = getSupabase();

  const { error: upsertError } = await supabase
    .from("google_shopping_tokens")
    .upsert(
      { environment: "production", merchant_id: merchantId.trim(), updated_at: new Date().toISOString() },
      { onConflict: "environment" }
    );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  try {
    const { accessToken } = await getGoogleShoppingConnection();

    // Optional one-time step: the GCP project behind the service account must be
    // registered as a developer on the Merchant Center account before any other
    // Merchant API call works (Google returns 401 GCP_NOT_REGISTERED otherwise).
    // Only needs to run once ever per GCP project — pass developerEmail the first
    // time a fresh project hits that error, omit it on every later reconnect.
    if (developerEmail && typeof developerEmail === "string") {
      await registerDeveloper(merchantId.trim(), accessToken, developerEmail.trim());
    }

    const dataSource = await ensureDataSource(merchantId.trim(), accessToken);
    await saveDataSource(dataSource.name, dataSource.feedLabel, dataSource.contentLanguage);
    return NextResponse.json({ connected: true, dataSourceName: dataSource.name });
  } catch (e: unknown) {
    // Roll back so a bad merchantId/service account doesn't leave a half-connected row.
    await supabase.from("google_shopping_tokens").delete().eq("environment", "production");
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
