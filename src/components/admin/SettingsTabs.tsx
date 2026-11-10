"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ComponentType } from "react";
import { Bell, Image as ImageIcon, Search, Mail, Ticket, Users, Link2 } from "lucide-react";
import { GoogleLogo, FacebookLogo } from "@/components/brand-logos";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { OPERADOR_SETTINGS } from "@/components/admin-v2/nav";

type Tab = {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  logo?: ComponentType<{ className?: string }>;
  image?: string;
  adminOnly?: boolean;
};

const TABS: Tab[] = [
  { href: "/admin/settings", label: "Notificações", icon: Bell },
  { href: "/admin/settings/banners", label: "Pop-ups", icon: ImageIcon },
  { href: "/admin/settings/automatic-emails", label: "E-mails Automáticos", icon: Mail },
  { href: "/admin/settings/coupons", label: "Cupons", icon: Ticket },
  { href: "/admin/settings/seo", label: "SEO", icon: Search },
  { href: "/admin/settings/google", label: "Google", logo: GoogleLogo },
  { href: "/admin/settings/facebook", label: "Facebook", logo: FacebookLogo },
  { href: "/admin/settings/link-bio", label: "Link na Bio", icon: Link2 },
  { href: "/admin/settings/users", label: "Usuários", icon: Users, adminOnly: true },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  // Non-admins (operador) only manage pop-ups, coupons and the link-in-bio.
  const visibleTabs = isAdmin ? TABS : TABS.filter((t) => OPERADOR_SETTINGS.includes(t.href));
  const barRef = useRef<HTMLDivElement>(null);
  // Phones: the bar scrolls sideways, so bring the active tab into view.
  useEffect(() => {
    const bar = barRef.current;
    const el = bar?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!bar || !el || !window.matchMedia("(max-width: 767px)").matches || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollLeft = el.offsetLeft - (bar.clientWidth - el.offsetWidth) / 2;
  }, [pathname]);
  return (
    <div
      ref={barRef}
      className="flex gap-2 border-b pb-3 overflow-x-auto max-md:-mx-4 max-md:gap-1.5 max-md:px-4 max-md:pb-2.5 max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden"
    >
      {visibleTabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        const Logo = t.logo;
        return (
          <Link
            key={t.href}
            href={t.href}
            title={t.label}
            aria-label={t.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0 max-md:gap-1.5 max-md:px-3",
              active ? "bg-black text-white" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {Logo ? (
              <>
                <Logo className="h-5 w-5" />
                {t.label}
              </>
            ) : t.image ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image} alt={t.label} className="h-4 w-auto object-contain" />
                {t.label}
              </>
            ) : Icon ? (
              <>
                <Icon className="h-4 w-4" />
                {t.label}
              </>
            ) : (
              t.label
            )}
          </Link>
        );
      })}
    </div>
  );
}
