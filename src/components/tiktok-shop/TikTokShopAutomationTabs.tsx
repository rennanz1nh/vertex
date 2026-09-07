"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Tag, ListChecks, DollarSign, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/automations/tiktok-shop/orders", label: "Pedidos", icon: Package },
  { href: "/admin/automations/tiktok-shop/listings", label: "Listings", icon: ListChecks },
  { href: "/admin/automations/tiktok-shop/price", label: "Automação de Preço", icon: Tag },
  { href: "/admin/automations/tiktok-shop/reports/sales", label: "Relatório de Vendas", icon: DollarSign },
  { href: "/admin/automations/tiktok-shop/settings", label: "Configurações", icon: Settings },
];

export function TikTokShopAutomationTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-2 border-b pb-3 overflow-x-auto">
      {TABS.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
              active ? "bg-black text-white" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
