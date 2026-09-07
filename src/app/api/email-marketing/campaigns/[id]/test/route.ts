import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendTestCampaign } from "@/lib/brevo";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId)) return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });

  const { emails } = await request.json();
  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "Missing emails" }, { status: 400 });
  }

  try {
    await sendTestCampaign(campaignId, emails);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to send test campaign" }, { status: 500 });
  }
}
