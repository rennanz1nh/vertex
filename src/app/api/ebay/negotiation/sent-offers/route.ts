import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const RETENTION_DAYS = 30;

// Read-only history of eBay offers sent in the last 30 days, shown greyed out below the
// eligible-items list on the Send Offer page.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const since = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("ebay_offers_sent")
    .select("id, listing_id, title, image, original_price, discount_percentage, offered_price, currency, quantity, message, sent_at")
    .gte("sent_at", since)
    .order("sent_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ offers: data ?? [] });
}
