"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ShoppingBag, Truck, Tag, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { authedFetch } from "@/lib/admin-fetch";
import { supabase } from "@/integrations/supabase/client";

type Notification = {
  id: string;
  type: "new_order" | "delivery_update" | "ebay_offer_eligible" | "order_cancelled";
  title: string;
  message: string | null;
  link: string | null;
  created_at: string;
};

const ICONS = {
  new_order: ShoppingBag,
  delivery_update: Truck,
  ebay_offer_eligible: Tag,
  order_cancelled: XCircle,
} as const;

/**
 * Bell in the admin header — new sales, delivery status updates (Enviado/Entregue), and
 * eBay "send offer" eligibility. Separate from the ntfy.sh push system (Settings >
 * Notifications): this is the in-app feed, backed by admin_notifications + Realtime.
 */
export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    const res = await authedFetch("/api/admin/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  };

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel("admin-notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "admin_notifications" }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next && unreadCount > 0) {
      setUnreadCount(0);
      await authedFetch("/api/admin/notifications/mark-seen", { method: "POST" });
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-9 w-9 shrink-0" title="Notificações">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto bg-popover">
        <DropdownMenuLabel>Notificações</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhuma notificação ainda</p>
        ) : (
          notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => { setOpen(false); if (n.link) router.push(n.link); }}
                className="flex w-full items-start gap-2.5 px-2 py-2 text-left text-sm hover:bg-accent rounded-sm"
              >
                <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{n.title}</p>
                  {n.message && <p className="text-xs text-muted-foreground truncate">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
