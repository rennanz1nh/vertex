import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

type CouponRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  active: boolean;
  stripe_coupon_id: string | null;
  stripe_promotion_code_id: string | null;
};

/** Creates the matching Stripe Coupon + Promotion Code for a row that doesn't have one
 *  yet — lets a coupon be seeded straight into the DB (by migration or import) without
 *  needing STRIPE_SECRET_KEY at that time, and self-heals the first time it's listed. */
async function ensureInStripe(row: CouponRow): Promise<{ stripe_coupon_id: string; stripe_promotion_code_id: string }> {
  const coupon = await stripe.coupons.create({
    duration: "forever",
    ...(row.discount_type === "percent"
      ? { percent_off: row.discount_value }
      : { amount_off: Math.round(row.discount_value * 100), currency: "usd" }),
  });
  const promotionCode = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: row.code,
    active: row.active,
  });
  return { stripe_coupon_id: coupon.id, stripe_promotion_code_id: promotionCode.id };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const supabase = getSupabase();
  const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const coupons = await Promise.all(
    (data as CouponRow[]).map(async (row) => {
      if (row.stripe_promotion_code_id) return row;
      try {
        const ids = await ensureInStripe(row);
        const { data: updated } = await supabase.from("coupons").update(ids).eq("id", row.id).select().single();
        return updated ?? row;
      } catch (err) {
        console.error(`Failed to sync coupon ${row.code} to Stripe`, err);
        return row; // still show it — just without a working Stripe code yet
      }
    })
  );

  return NextResponse.json({ coupons });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const discountType = body.discount_type === "fixed" ? "fixed" : "percent";
  const discountValue = Number(body.discount_value);

  if (!code) return NextResponse.json({ error: "Código é obrigatório" }, { status: 400 });
  if (!discountValue || discountValue <= 0) return NextResponse.json({ error: "Valor de desconto inválido" }, { status: 400 });
  if (discountType === "percent" && discountValue > 100) {
    return NextResponse.json({ error: "Desconto percentual não pode passar de 100%" }, { status: 400 });
  }

  try {
    const coupon = await stripe.coupons.create({
      duration: "forever",
      ...(discountType === "percent" ? { percent_off: discountValue } : { amount_off: Math.round(discountValue * 100), currency: "usd" }),
    });
    const promotionCode = await stripe.promotionCodes.create({ promotion: { type: "coupon", coupon: coupon.id }, code });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("coupons")
      .insert({
        code,
        description,
        discount_type: discountType,
        discount_value: discountValue,
        stripe_coupon_id: coupon.id,
        stripe_promotion_code_id: promotionCode.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ coupon: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
