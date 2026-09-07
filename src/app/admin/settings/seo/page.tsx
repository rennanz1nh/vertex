"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SettingsHeader } from "@/components/admin/SettingsHeader";
import SeoGeneralTab from "./SeoGeneralTab";
import SeoPagesTab from "./SeoPagesTab";
import SeoProductsTab from "./SeoProductsTab";

type SubTab = "geral" | "paginas" | "produtos";

const SUBTABS: { key: SubTab; label: string }[] = [
  { key: "geral", label: "Geral" },
  { key: "paginas", label: "Páginas" },
  { key: "produtos", label: "Produtos" },
];

export default function SeoSettingsPage() {
  const [tab, setTab] = useState<SubTab>("geral");

  return (
    <div className="space-y-6">
      <SettingsHeader />

      <div className="flex gap-1 border-b">
        {SUBTABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-black text-black"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "geral" && <SeoGeneralTab />}
      {tab === "paginas" && <SeoPagesTab />}
      {tab === "produtos" && <SeoProductsTab />}
    </div>
  );
}
