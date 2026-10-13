"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isMasterAdminEmail } from "@/lib/master-admin";
import { authedFetch } from "@/lib/admin-fetch";
import { AlertCircle } from "lucide-react";
import { TuroConfig, TuroTrip, TuroStats } from "@/components/admin/turo/shared";
import { OverviewTab } from "@/components/admin/turo/OverviewTab";
import { ReservationsTab } from "@/components/admin/turo/ReservationsTab";
import { VehiclesTab } from "@/components/admin/turo/VehiclesTab";
import { GuestsTab } from "@/components/admin/turo/GuestsTab";
import { SyncTab } from "@/components/admin/turo/SyncTab";

export const TURO_TABS = [
  { id: "overview", label: "Visão Geral" },
  { id: "reservations", label: "Reservas" },
  { id: "vehicles", label: "Veículos" },
  { id: "guests", label: "Hóspedes" },
  { id: "sync", label: "Sincronização" },
] as const;

type TabId = (typeof TURO_TABS)[number]["id"];

export default function TuroPage() {
  const { user, loading: authLoading } = useAuth();
  const isMaster = isMasterAdminEmail(user?.email);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: TabId = (TURO_TABS.find((t) => t.id === tabParam)?.id ?? "overview") as TabId;

  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<TuroConfig | null>(null);
  const [trips, setTrips] = useState<TuroTrip[]>([]);
  const [stats, setStats] = useState<TuroStats | null>(null);

  const loadConfig = useCallback(async () => {
    const res = await authedFetch("/api/admin/turo/config");
    if (res.ok) {
      const data = await res.json();
      setConnected(data.connected);
      setConfig(data.config);
      return !!data.connected;
    }
    return false;
  }, []);

  const loadTrips = useCallback(async () => {
    const res = await authedFetch("/api/admin/turo/trips?filter=all");
    if (res.ok) setTrips((await res.json()).trips ?? []);
  }, []);

  const loadStats = useCallback(async () => {
    const res = await authedFetch("/api/admin/turo/stats");
    if (res.ok) setStats(await res.json() as TuroStats);
  }, []);

  const reloadAll = useCallback(async () => {
    const isConnected = await loadConfig();
    if (isConnected) await Promise.all([loadTrips(), loadStats()]);
    else { setTrips([]); setStats(null); }
  }, [loadConfig, loadTrips, loadStats]);

  useEffect(() => { if (isMaster) reloadAll(); }, [isMaster, reloadAll]);

  function setTab(id: TabId) {
    router.replace(`${pathname}?tab=${id}`);
  }

  if (!authLoading && !isMaster) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground mt-1">Esta página está disponível apenas para o administrador master.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Turo</h1>
        <p className="text-sm text-muted-foreground">Integração completa com sua conta de host no Turo</p>
      </div>

      {/* Tab nav */}
      <div className="border-b flex gap-1 overflow-x-auto">
        {TURO_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              activeTab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!connected && activeTab !== "sync" ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Turo não está conectado.</p>
          <button onClick={() => setTab("sync")} className="text-indigo-600 text-sm mt-1 underline">Ir para Sincronização →</button>
        </div>
      ) : (
        <>
          {activeTab === "overview" && <OverviewTab stats={stats} />}
          {activeTab === "reservations" && <ReservationsTab trips={trips} />}
          {activeTab === "vehicles" && <VehiclesTab trips={trips} />}
          {activeTab === "guests" && <GuestsTab trips={trips} />}
          {activeTab === "sync" && <SyncTab config={config} connected={connected} onChanged={reloadAll} />}
        </>
      )}
    </div>
  );
}
