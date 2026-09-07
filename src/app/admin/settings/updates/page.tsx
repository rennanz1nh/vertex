"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings as SettingsIcon, History } from "lucide-react";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { UPDATES } from "@/data/updates";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function UpdatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Preferências gerais do sistema</p>
        </div>
      </div>

      <SettingsTabs />

      <div className="max-w-3xl space-y-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><History className="h-5 w-5" />Updates</h2>
          <p className="text-muted-foreground text-sm">Histórico de atualizações feitas na plataforma.</p>
        </div>

        {UPDATES.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atualização registrada ainda.</p>
        ) : (
          UPDATES.map((entry) => (
            <Card key={entry.version}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Badge className="bg-black text-white hover:bg-black">v{entry.version}</Badge>
                </CardTitle>
                <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
              </CardHeader>
              <CardContent className="space-y-4">
                {entry.sections.map((section) => (
                  <div key={section.category}>
                    <h3 className="text-sm font-semibold mb-1.5">{section.category}</h3>
                    <ul className="space-y-1.5">
                      {section.items.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2">
                          <span className="text-foreground">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
