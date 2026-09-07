import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

// Loads the thread and marks it read (unread_count -> 0) in the same call.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  const { id } = await params;
  const supabase = getSupabase();

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("id, sender_type, body, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase.from("chat_conversations").update({ unread_count: 0 }).eq("id", id);

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({ conversation_id: id, sender_type: "admin", body: text })
    .select("id, sender_type, body, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("chat_conversations")
    .update({ last_message_at: message.created_at, last_message_preview: text.slice(0, 200) })
    .eq("id", id);

  return NextResponse.json({ message });
}
