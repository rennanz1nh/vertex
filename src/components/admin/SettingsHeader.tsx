import { Settings as SettingsIcon } from "lucide-react";
import { SettingsTabs } from "@/components/admin/SettingsTabs";

// Shared header (title + tab bar) for every Settings sub-page.
export function SettingsHeader() {
  return (
    <>
      <div className="flex items-center gap-3 max-md:gap-2.5">
        <SettingsIcon className="h-7 w-7 max-md:shrink-0 max-md:h-6 max-md:w-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm max-md:text-xs">Preferências gerais do sistema</p>
        </div>
      </div>
      <SettingsTabs />
    </>
  );
}
