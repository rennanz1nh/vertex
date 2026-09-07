"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RefreshCw, BarChart3, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/automations/google-shopping/sync", label: "Sincronização de Produtos", icon: RefreshCw },
  { href: "/admin/automations/google-shopping/products", label: "Status", icon: CheckCircle2 },
  { href: "/admin/automations/google-shopping/reports/performance", label: "Performance", icon: BarChart3 },
];

export function GoogleShoppingAutomationTabs() {
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
