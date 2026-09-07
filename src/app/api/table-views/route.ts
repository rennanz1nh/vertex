import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Column order/visibility for one admin table (?key=products|orders|shippo|clients).
// One global row per key — shared across prod/dev/local, no per-environment copies.

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const key = request.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("table_view_preferences")
    .select("column_order, column_visibility")
    .eq("storage_key", key)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    columnOrder: data?.column_order ?? null,
    columnVisibility: data?.column_visibility ?? null,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const key = typeof body?.key === "string" ? body.key : null;
  const columnOrder = Array.isArray(body?.columnOrder) ? body.columnOrder : null;
  const columnVisibility = body?.columnVisibility && typeof body.columnVisibility === "object" ? body.columnVisibility : null;

  if (!key || !columnOrder || !columnVisibility) {
    return NextResponse.json({ error: "Missing key, columnOrder or columnVisibility" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("table_view_preferences")
    .upsert(
      { storage_key: key, column_order: columnOrder, column_visibility: columnVisibility, updated_at: new Date().toISOString() },
      { onConflict: "storage_key" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
