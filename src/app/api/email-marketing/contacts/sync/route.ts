import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { upsertContact } from "@/lib/brevo";

// Mirrors every client with an email into Brevo as a contact, tagging their
// canal_principal so campaigns can be segmented by origin (Newsletter, Online, etc).
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { data: clients, error } = await supabaseAdmin
    .from("clients")
    .select("nome_razao, email, canal_principal")
    .not("email", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const client of clients ?? []) {
    if (!client.email) continue;
    try {
      await upsertContact({
        email: client.email,
        attributes: {
          FIRSTNAME: client.nome_razao ?? undefined,
          ORIGEM: client.canal_principal ?? undefined,
        },
      });
      synced++;
    } catch (err: any) {
      failed++;
      errors.push(`${client.email}: ${err?.message ?? "unknown error"}`);
    }
  }

  return NextResponse.json({ total: clients?.length ?? 0, synced, failed, errors: errors.slice(0, 20) });
}
