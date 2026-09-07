import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const LIST_LIMIT = 30;

// Latest notifications for the admin bell, plus whether each is unread (created after the
// shared last_seen_at) and the current unread count.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const [{ data: notifications, error: listError }, { data: seenRow }] = await Promise.all([
    supabaseAdmin
      .from("admin_notifications")
      .select("id, type, title, message, link, created_at")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabaseAdmin.from("admin_notifications_seen").select("last_seen_at").eq("id", true).maybeSingle(),
  ]);

  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

  const lastSeenAt = seenRow?.last_seen_at ?? null;
  const unreadCount = lastSeenAt
    ? (notifications ?? []).filter((n) => n.created_at > lastSeenAt).length
    : (notifications ?? []).length;

  return NextResponse.json({ notifications: notifications ?? [], unreadCount, lastSeenAt });
}
