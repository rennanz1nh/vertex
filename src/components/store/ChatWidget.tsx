"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";

type ChatMessage = {
  id: string;
  sender_type: "visitor" | "admin";
  body: string;
  created_at: string;
};

const CONVERSATION_KEY = "cm-chat-conversation-id";
const SEEN_COUNT_KEY = "cm-chat-seen-count";
// Public store chat stays on polling (anon visitors can't safely subscribe to Realtime
// without exposing other people's conversations). Intervals kept deliberately slow, and
// polling pauses entirely when the browser tab isn't visible, to keep Vercel function
// invocations low. Admin side uses Realtime instead.
const OPEN_POLL_MS = 15000;
const BACKGROUND_POLL_MS = 60000;

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConversationId(localStorage.getItem(CONVERSATION_KEY));
  }, []);

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/chat/messages?conversationId=${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const list: ChatMessage[] = data.messages ?? [];
      setMessages(list);

      const seen = Number(localStorage.getItem(SEEN_COUNT_KEY) ?? "0");
      if (list.length > seen) {
        if (open) {
          localStorage.setItem(SEEN_COUNT_KEY, String(list.length));
          setHasUnseen(false);
        } else {
          setHasUnseen(true);
        }
      }
    } catch {
      // best-effort background poll; ignore transient network errors
    }
  };

  // Light background poll so a reply shows an unread dot even before the panel is opened.
  // Pauses while the tab is hidden (no point polling a backgrounded tab) and does one
  // immediate catch-up fetch when the tab becomes visible again.
  useEffect(() => {
    if (!conversationId) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (interval) return;
      fetchMessages(conversationId);
      interval = setInterval(() => fetchMessages(conversationId), open ? OPEN_POLL_MS : BACKGROUND_POLL_MS);
    };
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null; }
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, open]);

  useEffect(() => {
    if (open && messages.length) {
      localStorage.setItem(SEEN_COUNT_KEY, String(messages.length));
      setHasUnseen(false);
    }
  }, [open, messages.length]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");

      if (!conversationId && data.conversationId) {
        localStorage.setItem(CONVERSATION_KEY, data.conversationId);
        setConversationId(data.conversationId);
      }
      setMessages((prev) => [...prev, data.message]);
      localStorage.setItem(SEEN_COUNT_KEY, String(messages.length + 1));
    } catch {
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div
        className={`fixed bottom-5 right-5 z-[80] bg-white w-[92vw] max-w-sm h-[70vh] max-h-[520px] rounded-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 origin-bottom-right ${
          open ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Chat with us"
      >
        <div className="bg-brand text-white px-4 py-4 flex items-center justify-between shrink-0">
          <div>
            <p className="font-semibold text-sm">Vertex Rental Cars</p>
            <p className="text-xs text-white/80">We&apos;ll reply as soon as we can</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Close chat">
            <X size={20} />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-gray-50">
          {messages.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-6">Send us a message and we&apos;ll get back to you shortly.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_type === "visitor" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                  m.sender_type === "visitor"
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
          className="flex items-center gap-2 border-t border-gray-100 px-3 py-3 shrink-0"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write your message…"
            className="flex-1 text-sm border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:border-brand transition-colors"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="bg-brand text-white rounded-full w-9 h-9 flex items-center justify-center shrink-0 hover:bg-brand-hover transition-colors disabled:opacity-40"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[80] bg-brand hover:bg-brand-hover text-white rounded-full pl-4 pr-5 py-3 shadow-lg flex items-center gap-2 text-sm font-medium transition-all"
        aria-label={open ? "Close chat" : "Open chat"}
        style={{ display: open ? "none" : "flex" }}
      >
        <span className="relative">
          <MessageCircle size={20} />
          {hasUnseen && (
            <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-yellow-400 border border-white" />
          )}
        </span>
        Contact Us
      </button>
    </>
  );
}
