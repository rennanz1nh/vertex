import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { upsertContact } from "@/lib/brevo";
import { sendAutomaticEmail } from "@/lib/automatic-emails";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const { name, email } = await req.json();

  if (typeof name !== "string" || !name.trim() || typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid name or email" }, { status: 400 });
  }

  const { data: existingClient } = await supabase
    .from("clients")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingClient) {
    await supabase.from("clients").update({ canal_principal: "Newsletter" }).eq("id", existingClient.id);
  } else {
    const { error: insertError } = await supabase.from("clients").insert({
      nome_razao: name,
      email,
      tipo: "Cliente Final" as const,
      canal_principal: "Newsletter",
    });

    if (insertError) {
      console.error("Failed to create newsletter client:", insertError);
      return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
    }
  }

  if (!process.env.BREVO_API_KEY) {
    console.warn("BREVO_API_KEY not set, skipping newsletter contact sync and welcome email");
    return NextResponse.json({ ok: true });
  }

  try {
    await upsertContact({ email, attributes: { FIRSTNAME: name } });
  } catch (err) {
    console.error("Failed to sync newsletter contact to Brevo:", err);
  }

  await sendAutomaticEmail("newsletter_welcome", { email, name }, { customer_name: name });

  return NextResponse.json({ ok: true });
}
