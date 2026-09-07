import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getTemplates, createTemplate } from "@/lib/brevo";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const data = await getTemplates({ limit: 50 });
    return NextResponse.json({ templates: data?.templates ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { templateName, subject, htmlContent } = await request.json();
  if (
    typeof templateName !== "string" || !templateName.trim() ||
    typeof subject !== "string" || !subject.trim() ||
    typeof htmlContent !== "string" || !htmlContent.trim()
  ) {
    return NextResponse.json({ error: "Missing templateName, subject or htmlContent" }, { status: 400 });
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    return NextResponse.json({ error: "BREVO_SENDER_EMAIL is not configured" }, { status: 500 });
  }

  try {
    const template = await createTemplate({
      templateName,
      subject,
      htmlContent,
      sender: { name: "Vertex Rental Cars", email: senderEmail },
    });
    return NextResponse.json({ template });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to create template" }, { status: 500 });
  }
}
