"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";
import { useAuth } from "@/hooks/useAuth";
import { isMasterAdminEmail } from "@/lib/master-admin";
import { TURO_STALE_HOURS } from "@/lib/turo-token-row";

/**
 * Site availability blocks the dates of Turo trips, but only as fresh as the last sync.
 * When that sync is older than TURO_STALE_HOURS the site may show a car as free while it
 * is rented on Turo, so the master admin gets a banner on every admin page.
 */
export function TuroSyncStaleBanner() {
  const { user, profile } = useAuth();
  // The whole team can sync now, so everyone on it sees the warning.
  const isMaster = isMasterAdminEmail(user?.email) || profile?.role === "admin" || profile?.role === "operador";
  // Hours since the last sync (Infinity = never), measured when the config arrives.
  const [hours, setHours] = useState<number | null>(null);
  // Why the extension didn't sync, when it told us (e.g. logged out of Turo).
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!isMaster) return;
    let cancelled = false;
    authedFetch("/api/admin/turo/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        const last: string | null = d.config?.last_synced_at ?? null;
        setHours(last ? (Date.now() - new Date(last).getTime()) / 3_600_000 : Infinity);
        const c = d.config ?? {};
        if (c.extension_ok === false && c.extension_message) {
          const at = c.extension_seen_at ? new Date(c.extension_seen_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
          setReason(`Extensão${at ? ` (${at})` : ""}: ${c.extension_message}`);
        } else if (c.extension_seen_at) {
          setReason(`A extensão não roda desde ${new Date(c.extension_seen_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}: o Chrome com a extensão precisa estar aberto e o computador ligado.`);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isMaster]);

  if (!isMaster || hours === null || hours < TURO_STALE_HOURS) return null;

  const age = hours === Infinity ? "nunca sincronizou" : hours < 48 ? `há ${Math.floor(hours)}h` : `há ${Math.floor(hours / 24)} dias`;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[10px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <b>Turo desatualizada ({age}).</b> O site pode mostrar como livre um carro que já está alugado na Turo.{" "}
        <Link href="/admin/turo?tab=sync" className="font-semibold underline">Sincronizar agora</Link>
        {reason && <span className="mt-0.5 block text-xs">{reason}</span>}
      </p>
    </div>
  );
}
