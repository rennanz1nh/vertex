import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAutomationSettings, updateAutomationSettings, type AutomationSettingsUpdate } from "@/lib/social-media/pipeline-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const settings = await getAutomationSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load automation settings" }, { status: 500 });
  }
}

const BOOLEAN_FIELDS = [
  "watch_folder_enabled",
  "auto_analysis",
  "auto_generate_captions",
  "auto_generate_hashtags",
  "require_approval",
  "auto_publish_enabled",
] as const;

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok || !auth.userId) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const patch: AutomationSettingsUpdate = {};
  for (const field of BOOLEAN_FIELDS) {
    if (typeof body[field] === "boolean") patch[field] = body[field];
  }
  if (body.default_account_ids && typeof body.default_account_ids === "object") {
    patch.default_account_ids = body.default_account_ids;
  }
  if (typeof body.metrics_sync_interval_minutes === "number" && body.metrics_sync_interval_minutes > 0) {
    patch.metrics_sync_interval_minutes = body.metrics_sync_interval_minutes;
  }

  try {
    const settings = await updateAutomationSettings(patch, { source: "hub_ui", userId: auth.userId });
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update automation settings" }, { status: 500 });
  }
}
