"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Database, ScrollText, TrendingUp, Users, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/automations/google-cloud/overview", label: "Visão Geral", icon: LayoutGrid },
  { href: "/admin/automations/google-cloud/traffic", label: "Website Analytics", icon: TrendingUp },
  { href: "/admin/automations/google-cloud/bigquery", label: "BigQuery", icon: Database },
  { href: "/admin/automations/google-cloud/billing", label: "Faturamento", icon: Receipt },
  { href: "/admin/automations/google-cloud/iam", label: "Acessos (IAM)", icon: Users },
  { href: "/admin/automations/google-cloud/logs", label: "Logs", icon: ScrollText },
];

export function GoogleCloudAutomationTabs() {
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
