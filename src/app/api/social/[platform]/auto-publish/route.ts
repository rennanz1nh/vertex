import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidPlatform } from "@/lib/social-platforms";
import { requireAdmin } from "@/lib/admin-auth";
import { logAuditEvent } from "@/lib/audit-log";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * The per-account half of AUTO publish mode's opt-in (see auto-publish-service.ts —
 * this toggle is meaningless unless social_automation_settings.auto_publish_enabled
 * is also on). Deliberately a dedicated endpoint, not folded into the generic account
 * update: flipping this is a real "let the system post without me looking" decision,
 * worth its own explicit, auditable action rather than a silent field in a bigger form.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { platform } = await params;
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: "Plataforma desconhecida" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "'enabled' (boolean) is required" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: account, error: fetchError } = await supabase
    .from("social_media_accounts")
    .select("id, can_publish")
    .eq("platform", platform)
    .maybeSingle();
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!account) return NextResponse.json({ error: "Nenhuma conta conectada nessa plataforma" }, { status: 404 });
  if (body.enabled && !account.can_publish) {
    return NextResponse.json({ error: "Esta conta ainda não tem permissão de publicação — reconecte com o escopo de publicação antes de ativar." }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("social_media_accounts")
    .update({ auto_publish_authorized: body.enabled, updated_at: new Date().toISOString() })
    .eq("id", account.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await logAuditEvent({
    tableName: "social_media_accounts",
    recordId: account.id,
    action: body.enabled ? "auto_publish_authorized" : "auto_publish_deauthorized",
    userId: auth.userId,
    source: "hub_ui",
    newValues: { platform, auto_publish_authorized: body.enabled },
  });

  return NextResponse.json({ ok: true, autoPublishAuthorized: body.enabled });
}
