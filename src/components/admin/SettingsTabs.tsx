"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { Bell, History, Image as ImageIcon, Search, Mail, Ticket } from "lucide-react";
import { GoogleLogo, FacebookLogo } from "@/components/brand-logos";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  // When set, the tab shows this brand logo instead of an icon + text label.
  logo?: ComponentType<{ className?: string }>;
  // Static brand asset (used where we have a real logo file rather than an inline mark).
  image?: string;
};

const TABS: Tab[] = [
  { href: "/admin/settings", label: "Notificações", icon: Bell },
  { href: "/admin/settings/banners", label: "Pop-ups", icon: ImageIcon },
  { href: "/admin/settings/automatic-emails", label: "E-mails Automáticos", icon: Mail },
  { href: "/admin/settings/coupons", label: "Cupons", icon: Ticket },
  { href: "/admin/settings/seo", label: "SEO", icon: Search },
  { href: "/admin/settings/google", label: "Google", logo: GoogleLogo },
  { href: "/admin/settings/facebook", label: "Facebook", logo: FacebookLogo },
  { href: "/admin/settings/amazon", label: "Amazon", image: "/images/sales-channels/Amazon.png" },
  { href: "/admin/settings/updates", label: "Updates", icon: History },
];

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 border-b pb-3 overflow-x-auto">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        const Logo = t.logo;
        return (
          <Link
            key={t.href}
            href={t.href}
            title={t.label}
            aria-label={t.label}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap shrink-0",
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
