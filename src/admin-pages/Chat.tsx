"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authedFetch } from "@/lib/admin-fetch";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Send, MessageCircle, ArrowLeft } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type Conversation = {
  id: string;
  visitor_name: string | null;
  created_at: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  closed: boolean;
};

type Message = {
  id: string;
  sender_type: "visitor" | "admin";
  body: string;
  created_at: string;
};

export default function Chat() {
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("c"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    const res = await authedFetch("/api/admin/chat/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
    }
    setLoadingList(false);
  }, []);

  const fetchMessages = useCallback(async (id: string) => {
    const res = await authedFetch(`/api/admin/chat/conversations/${id}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
  }, []);

  // Conversation list: load once, then let Realtime refresh it whenever any message or
  // conversation row changes (new visitor message, unread count, last_message_at, etc).
  // Replaces the old 6s polling loop — no requests go out unless something actually changed.
  useEffect(() => {
    fetchConversations();
    const channel = supabase
      .channel("admin-chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => fetchConversations())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  // Open thread: load once, then refresh on any new message in that specific conversation.
  // Replaces the old 4s polling loop.
  useEffect(() => {
    if (!selectedId) return;
    fetchMessages(selectedId);
    const channel = supabase
      .channel(`admin-chat-thread-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${selectedId}` },
        () => fetchMessages(selectedId)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedId, fetchMessages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await authedFetch(`/api/admin/chat/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, data.message]);
        fetchConversations();
      } else {
        setDraft(text);
      }
    } finally {
      setSending(false);
    }
  };

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Mensagens</h1>
      <p className="text-sm text-gray-500 mb-5">Conversas iniciadas pelo chat do site</p>

      <Card className="flex h-[calc(100vh-220px)] min-h-[420px] overflow-hidden p-0">
        {/* On mobile, list and conversation are two full-width panes, one at a time
            (like a typical chat app) — from sm: up they sit side by side as before. */}
        <div className={cn("w-full sm:w-72 sm:shrink-0 border-r border-gray-100 overflow-y-auto", selected && "hidden sm:block")}>
          {loadingList ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-gray-400 text-center mt-10 px-4">Nenhuma conversa ainda.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selectedId === c.id ? "bg-gray-50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {c.visitor_name?.trim() || "Visitante do site"}
                  </span>
                  {c.unread_count > 0 && (
                    <span className="bg-brand text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                      {c.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{c.last_message_preview || "—"}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true, locale: ptBR })}
                </p>
              </button>
            ))
          )}
        </div>

        <div className={cn("flex-1 flex-col min-w-0", selected ? "flex" : "hidden sm:flex")}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <MessageCircle size={40} />
              <p className="text-sm text-gray-400 mt-2">Selecione uma conversa</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="sm:hidden -ml-1 p-1 text-gray-500 hover:text-gray-900"
                  aria-label="Voltar para conversas"
                >
                  <ArrowLeft size={18} />
                </button>
                <p className="text-sm font-semibold text-gray-900">{selected.visitor_name?.trim() || "Visitante do site"}</p>
              </div>

              <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_type === "admin" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                        m.sender_type === "admin"
                          ? "bg-brand text-white rounded-br-sm"
                          : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                      }`}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-center gap-2 border-t border-gray-100 px-4 py-3 shrink-0"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Responder…"
                  className="flex-1 text-sm border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-brand transition-colors"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="bg-brand text-white rounded-full w-9 h-9 flex items-center justify-center shrink-0 hover:bg-brand-hover transition-colors disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
