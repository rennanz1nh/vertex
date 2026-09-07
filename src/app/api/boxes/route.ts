import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { BoxPreset } from "@/lib/shippo-types";

// Box presets live in the DB (table box_presets) so they're shared across devices and
// between dev/prod, instead of per-browser localStorage. GET returns the full ordered
// list; PUT replaces the whole list (matching the old saveBoxes semantics).

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from("box_presets")
    .select("id, name, length, width, height, distance_unit, unit_count, image")
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const boxes: BoxPreset[] = (data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    length: b.length,
    width: b.width,
    height: b.height,
    distance_unit: (b.distance_unit === "cm" ? "cm" : "in") as "in" | "cm",
    unit_count: b.unit_count ?? undefined,
    image: b.image ?? undefined,
  }));

  return NextResponse.json({ boxes });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const boxes: BoxPreset[] = Array.isArray(body?.boxes) ? body.boxes : [];
  const onlyIfEmpty = body?.onlyIfEmpty === true;

  // onlyIfEmpty (used by the one-shot localStorage migration / default seed): bail out if
  // any rows already exist, so two tabs/browsers racing to seed can't both insert and
  // duplicate every box. A normal save (from the box manager) doesn't set this flag.
  if (onlyIfEmpty) {
    const { count, error: countError } = await supabaseAdmin
      .from("box_presets")
      .select("id", { count: "exact", head: true });
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if ((count ?? 0) > 0) return NextResponse.json({ ok: true, skipped: true });
  }

  // Replace the whole list: clear then insert in the given order.
  const { error: delError } = await supabaseAdmin.from("box_presets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  if (boxes.length > 0) {
    const rows = boxes.map((b, i) => ({
      name: b.name,
      length: b.length,
      width: b.width,
      height: b.height,
      distance_unit: b.distance_unit === "cm" ? "cm" : "in",
      unit_count: b.unit_count ?? null,
      image: b.image ?? null,
      sort_order: i,
    }));
    const { error: insError } = await supabaseAdmin.from("box_presets").insert(rows);
    if (insError) return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
