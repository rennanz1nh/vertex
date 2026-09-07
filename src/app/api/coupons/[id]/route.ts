import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Stripe promotion codes can't be renamed or have their discount changed after creation —
// only active/inactive toggles and the description are editable here. To change the code
// or discount, archive this one and create a new coupon.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();

  const supabase = getSupabase();
  const { data: row, error: fetchError } = await supabase.from("coupons").select("*").eq("id", id).maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Cupom não encontrado" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("description" in body) update.description = body.description;

  if ("active" in body) {
    const active = !!body.active;
    update.active = active;
    if (row.stripe_promotion_code_id) {
      try {
        await stripe.promotionCodes.update(row.stripe_promotion_code_id, { active });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 502 });
      }
    }
  }

  const { data, error } = await supabase.from("coupons").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coupon: data });
}
