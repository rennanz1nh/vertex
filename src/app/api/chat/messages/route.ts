import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { notifyNewChatMessage } from "@/lib/notify";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Polled by the widget while the panel is open to pick up admin replies.
export async function GET(request: NextRequest) {
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId || !UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: "conversationId inválido" }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, sender_type, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ messages: data });
}

// Creates a conversation on first message, or appends to an existing one.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const visitorName = typeof body.visitorName === "string" ? body.visitorName.trim().slice(0, 120) : null;
  const conversationId = typeof body.conversationId === "string" && UUID_RE.test(body.conversationId) ? body.conversationId : null;

  if (!text) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }
  if (text.length > 4000) {
    return NextResponse.json({ error: "Mensagem muito longa" }, { status: 400 });
  }

  const supabase = getSupabase();
  let convId = conversationId;

  if (convId) {
    const { data: existing } = await supabase.from("chat_conversations").select("id").eq("id", convId).maybeSingle();
    if (!existing) convId = null;
  }

  if (!convId) {
    const { data: created, error: createError } = await supabase
      .from("chat_conversations")
      .insert({ visitor_name: visitorName })
      .select("id")
      .single();
    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }
    convId = created.id;
  } else if (visitorName) {
    await supabase.from("chat_conversations").update({ visitor_name: visitorName }).eq("id", convId).is("visitor_name", null);
  }

  const { data: message, error: insertError } = await supabase
    .from("chat_messages")
    .insert({ conversation_id: convId, sender_type: "visitor", body: text })
    .select("id, sender_type, body, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { data: conv } = await supabase.from("chat_conversations").select("unread_count").eq("id", convId).maybeSingle();
  await supabase
    .from("chat_conversations")
    .update({
      last_message_at: message.created_at,
      last_message_preview: text.slice(0, 200),
      unread_count: (conv?.unread_count ?? 0) + 1,
      closed: false,
    })
    .eq("id", convId);

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  notifyNewChatMessage({ conversationId: convId, visitorName, preview: text, origin }).catch(() => {});

  return NextResponse.json({ conversationId: convId, message });
}
