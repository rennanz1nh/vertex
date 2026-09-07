import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendTestPushNotification, type PushTriggerKey } from "@/lib/notify";
import { PUSH_SAMPLE_VARS } from "@/lib/push-notifications-sample-vars";

export async function POST(request: NextRequest, { params }: { params: Promise<{ triggerKey: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { triggerKey } = await params;
  if (!(triggerKey in PUSH_SAMPLE_VARS)) return NextResponse.json({ error: "Tipo de notificação desconhecido" }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const key = triggerKey as PushTriggerKey;

  const result = await sendTestPushNotification(key, PUSH_SAMPLE_VARS[key], {
    ntfy_topic: body.ntfy_topic,
    title: body.title,
    message: body.message,
    tags: typeof body.tags === "string" ? body.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : undefined,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
