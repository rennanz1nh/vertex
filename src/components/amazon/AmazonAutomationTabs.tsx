"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tag, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AmazonOrderUploadDialog } from "@/components/orders/AmazonOrderUploadDialog";

const amazonLogo = "/images/sales-channels/Amazon.png";

const TABS = [
  { href: "/admin/automations/amazon/price", label: "Automação de Preço", icon: Tag },
  { href: "/admin/automations/amazon/reports/sales", label: "Relatório de Vendas", icon: DollarSign },
];

export function AmazonAutomationTabs() {
  const pathname = usePathname();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3 flex-wrap">
      <div className="flex gap-2 overflow-x-auto">
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

      <Button variant="outline" onClick={() => setUploadOpen(true)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={amazonLogo} alt="Amazon" className="mr-2 h-4 w-auto object-contain" />
        Upload Vendas
      </Button>

      <AmazonOrderUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onImported={() => {}}
      />
    </div>
  );
}
