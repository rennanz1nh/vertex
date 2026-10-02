import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const { data: links } = await supabaseAdmin
    .from("bio_links")
    .select("*")
    .order("position", { ascending: true });

  const { data: settings } = await supabaseAdmin
    .from("bio_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ links: links ?? [], settings });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json();
  const { action } = body as { action: string };

  if (action === "upsert_link") {
    const { id, title, url, icon, thumbnail_url, position, enabled } = body;
    if (!title || !url) {
      return NextResponse.json({ error: "Título e URL são obrigatórios" }, { status: 400 });
    }

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("bio_links")
        .update({
          title,
          url,
          icon: icon || null,
          thumbnail_url: thumbnail_url || null,
          position: position ?? 0,
          enabled: enabled ?? true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ link: data });
    }

    const { data: maxPos } = await supabaseAdmin
      .from("bio_links")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data, error } = await supabaseAdmin
      .from("bio_links")
      .insert({
        title,
        url,
        icon: icon || null,
        thumbnail_url: thumbnail_url || null,
        position: (maxPos?.position ?? -1) + 1,
        enabled: enabled ?? true,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ link: data });
  }

  if (action === "delete_link") {
    const { id } = body;
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });
    const { error } = await supabaseAdmin.from("bio_links").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "reorder") {
    const { order } = body as { order: { id: string; position: number }[] };
    if (!order?.length) return NextResponse.json({ error: "Ordem vazia" }, { status: 400 });
    for (const item of order) {
      await supabaseAdmin.from("bio_links").update({ position: item.position }).eq("id", item.id);
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "update_settings") {
    const {
      display_name,
      description,
      avatar_url,
      background_color,
      background_image_url,
      text_color,
      accent_color,
      button_style,
    } = body;

    const settingsData = {
      display_name: display_name ?? "Vertex Rental Cars",
      description: description ?? null,
      avatar_url: avatar_url ?? null,
      background_color: background_color ?? "#000000",
      background_image_url: background_image_url || null,
      text_color: text_color ?? "#ffffff",
      accent_color: accent_color || null,
      button_style: button_style ?? "rounded",
    };

    const { data: existing } = await supabaseAdmin.from("bio_settings").select("id").limit(1).maybeSingle();

    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("bio_settings")
        .update({ ...settingsData, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ settings: data });
    }

    const { data, error } = await supabaseAdmin
      .from("bio_settings")
      .insert(settingsData)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ settings: data });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
