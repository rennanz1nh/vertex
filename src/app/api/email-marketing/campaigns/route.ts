import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getCampaigns, createCampaign } from "@/lib/brevo";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const data = await getCampaigns({ limit: 50 });
    return NextResponse.json({ campaigns: data?.campaigns ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to fetch campaigns" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { name, subject, htmlContent, listIds, scheduledAt } = await request.json();

  if (
    typeof name !== "string" || !name.trim() ||
    typeof subject !== "string" || !subject.trim() ||
    typeof htmlContent !== "string" || !htmlContent.trim() ||
    !Array.isArray(listIds) || listIds.length === 0
  ) {
    return NextResponse.json({ error: "Missing name, subject, htmlContent or listIds" }, { status: 400 });
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    return NextResponse.json({ error: "BREVO_SENDER_EMAIL is not configured" }, { status: 500 });
  }

  try {
    const campaign = await createCampaign({
      name,
      subject,
      htmlContent,
      sender: { name: "Vertex Rental Cars", email: senderEmail },
      listIds,
      scheduledAt: typeof scheduledAt === "string" && scheduledAt ? scheduledAt : undefined,
    });
    return NextResponse.json({ campaign });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to create campaign" }, { status: 500 });
  }
}
