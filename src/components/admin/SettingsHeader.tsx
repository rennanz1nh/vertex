import { Settings as SettingsIcon } from "lucide-react";
import { SettingsTabs } from "@/components/admin/SettingsTabs";

// Shared header (title + tab bar) for every Settings sub-page.
export function SettingsHeader() {
  return (
    <>
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Preferências gerais do sistema</p>
        </div>
      </div>
      <SettingsTabs />
    </>
  );
}
