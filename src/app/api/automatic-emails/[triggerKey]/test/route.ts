import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/brevo";
import { SAMPLE_VARS, renderTemplate } from "@/lib/automatic-emails-sample-vars";
import { htmlToPlainText } from "@/lib/automatic-emails";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ triggerKey: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { triggerKey } = await params;
  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) return NextResponse.json({ error: "E-mail é obrigatório" }, { status: 400 });

  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from("automatic_emails")
    .select("subject, html_content, sender_name, sender_email")
    .eq("trigger_key", triggerKey)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Modelo não encontrado" }, { status: 404 });

  try {
    const htmlContent = renderTemplate(row.html_content, SAMPLE_VARS);
    await sendTransactionalEmail({
      to: [{ email }],
      subject: `[Teste] ${renderTemplate(row.subject, SAMPLE_VARS)}`,
      htmlContent,
      textContent: htmlToPlainText(htmlContent),
      sender: row.sender_email ? { name: row.sender_name || "Vertex Rental Cars", email: row.sender_email } : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
