import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

/**
 * Amazon's app is self-authorized (Fase 3 of the integration plan) — there is no OAuth
 * redirect callback like eBay's /api/ebay/callback. The seller generates a Refresh Token
 * directly in Seller Central and pastes it here, along with the Seller ID. Client ID /
 * Client Secret stay in env vars (AMAZON_CLIENT_ID / AMAZON_CLIENT_SECRET), same as
 * EBAY_APP_ID / EBAY_CERT_ID — never sent from the browser.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { refreshToken, sellerId, marketplaceId } = body;

  if (!refreshToken || typeof refreshToken !== "string") {
    return NextResponse.json({ error: "Refresh Token é obrigatório" }, { status: 400 });
  }
  if (!sellerId || typeof sellerId !== "string") {
    return NextResponse.json({ error: "Seller ID é obrigatório" }, { status: 400 });
  }

  const clientId = process.env.AMAZON_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "AMAZON_CLIENT_ID / AMAZON_CLIENT_SECRET não configurados no servidor." },
      { status: 500 }
    );
  }

  const tokenRes = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return NextResponse.json({ error: `Refresh Token inválido ou expirado: ${errText}` }, { status: 401 });
  }

  const tokenData = await tokenRes.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const supabase = getSupabase();
  const { error } = await supabase.from("amazon_tokens").upsert(
    {
      environment: "production",
      access_token: tokenData.access_token,
      refresh_token: refreshToken,
      access_token_expires_at: expiresAt,
      seller_id: sellerId,
      marketplace_id: marketplaceId || "ATVPDKIKX0DER",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "environment" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connected: true });
}
