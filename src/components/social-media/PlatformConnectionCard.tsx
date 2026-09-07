"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Link2, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlatformStatus {
  accountId: string | null;
  platform: string;
  label: string;
  configured: boolean;
  connected: boolean;
  accountName: string | null;
  avatarUrl: string | null;
  connectedAt: string | null;
  canPublish: boolean;
  autoPublishAuthorized: boolean;
}

interface Props {
  status: PlatformStatus;
  icon: React.ReactNode;
  active: boolean;
  disconnecting: boolean;
  onSelect: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  /** Only passed for platforms with a publishing adapter (Instagram/TikTok) — other platforms never show the AUTO row at all. */
  onToggleAutoPublish?: (enabled: boolean) => void;
  togglingAutoPublish?: boolean;
}

export function PlatformConnectionCard({
  status,
  icon,
  active,
  disconnecting,
  onSelect,
  onConnect,
  onDisconnect,
  onToggleAutoPublish,
  togglingAutoPublish,
}: Props) {
  return (
    // A <div role="button"> on purpose, not a <button>: this card wraps real
    // interactive controls (Conectar/Desconectar buttons, the auto-publish
    // Switch), and a <button> can't legally contain another <button> — the
    // browser's HTML parser closes the outer one early to fix the invalid
    // nesting, silently detaching it from everything meant to be inside it
    // (confirmed by reproducing the exact parsed DOM), which is why clicking
    // "Conectar" stopped doing anything once this card had more than one
    // interactive child. role="button" + tabIndex + onKeyDown keep it as
    // keyboard-operable as a real button.
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex-1 min-w-[200px] text-left rounded-lg border bg-card p-4 transition-colors hover:border-muted-foreground/30 cursor-pointer",
        active && "border-primary/50 shadow-sm"
      )}
    >
      <div className="flex items-center gap-3">
        <span className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {status.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={status.avatarUrl} alt={status.label} className="h-full w-full object-cover" />
          ) : (
            icon
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm truncate">{status.label}</div>
          <div className="text-xs text-muted-foreground truncate">
            {status.connected ? status.accountName ?? "Conectado" : status.configured ? "Não conectado" : "Não configurado"}
          </div>
        </div>
        {status.connected && (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">Conectado</Badge>
        )}
      </div>

      {status.connected && onToggleAutoPublish && (
        <div
          className="mt-3 flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-0">
            <div className="text-xs font-medium">Publicar automaticamente</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {status.canPublish ? "Sem revisão humana, quando o modo AUTO estiver ligado" : "Reconecte com permissão de publicação primeiro"}
            </div>
          </div>
          {togglingAutoPublish ? (
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          ) : (
            <Switch checked={status.autoPublishAuthorized} disabled={!status.canPublish} onCheckedChange={onToggleAutoPublish} />
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        {status.connected ? (
          <>
            <Button size="sm" variant="outline" className="flex-1" onClick={onConnect}>
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Trocar conta
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
            </Button>
          </>
        ) : (
          <Button size="sm" className="flex-1" onClick={onConnect} title={!status.configured ? "Credenciais de app não configuradas" : undefined}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" />
            Conectar
          </Button>
        )}
      </div>
    </div>
  );
}
