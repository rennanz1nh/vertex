import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";
import { Link2, Link2Off, AlertCircle, Copy, Check, Terminal, RefreshCw } from "lucide-react";
import { TuroConfig, fmtDateTime } from "./shared";

// Probes a broad set of candidate Turo endpoints (same-origin on turo.com) so we can
// map which expose earnings / receipts / reviews / messages / vehicles. Results are
// stored to turo_tokens.probe_data and surfaced in the discovery panel below.
const PROBE = `let tid=null,hid=null;try{const ff=(h.tripHistoryFeeds&&(h.tripHistoryFeeds.list||h.tripHistoryFeeds))||[];for(const m of ff){if(m.trips&&m.trips[0]){tid=m.trips[0].id;hid=m.trips[0].owner&&m.trips[0].owner.id;break;}}}catch(e){}let probe={tripId:tid,hostId:hid,results:{}};const P=[];if(tid){P.push('/api/reservation/'+tid,'/api/v2/reservation/'+tid,'/api/reservations/'+tid+'/receipt','/api/v2/reservations/'+tid,'/api/trips/'+tid,'/api/reservation/'+tid+'/cost','/api/v3/reservations/'+tid);}P.push('/api/v2/vehicles?driverRoles=HOST','/api/v2/earnings','/api/v2/search/host/me/earnings','/api/v2/reviews?driverRoles=HOST','/api/v2/messaging/threads','/api/host/me/transactions');if(hid){P.push('/api/drivers/'+hid+'/reviews','/api/v2/drivers/'+hid);}for(const pu of P){try{const rr=await fetch(pu);let v;if(rr.ok){const tx=await rr.text();try{v=JSON.parse(tx);}catch(_){v={_nonjson:tx.slice(0,200)};}}else{v=rr.status;}probe.results[pu]=v;}catch(e){probe.results[pu]=String(e);}}`;

function buildScript(auth: { key?: string; token?: string }) {
  const header = auth.key ? `'X-Sync-Key':'${auth.key}'` : `'X-Sync-Token':'${auth.token}'`;
  const prefix = auth.key ? "javascript:" : "";
  return `${prefix}(async()=>{try{const[u,h]=await Promise.all([fetch('/api/v2/feeds/upcoming-trips?appMode=HOST').then(r=>r.json()),fetch('/api/v2/feeds/trip-history?driverRoles=HOST').then(r=>r.json())]);${PROBE}const r=await fetch('https://vertexrentalcar.com/api/admin/turo/browser-sync',{method:'POST',headers:{'Content-Type':'application/json',${header}},body:JSON.stringify({upcomingData:u,historyData:h,probe:probe})});const d=await r.json();alert(d.synced>0?'✅ '+d.synced+' viagens sincronizadas!':'⚠️ '+JSON.stringify(d));}catch(e){alert('❌ '+e);}})();`;
}

type ProbeData = { tripId?: unknown; hostId?: unknown; results?: Record<string, unknown> };

function DiscoveryPanel({ probe }: { probe: ProbeData | null }) {
  const results = probe?.results ?? {};
  const entries = Object.entries(results);
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma sondagem ainda. Rode uma sincronização — os endpoints candidatos serão testados e aparecem aqui,
        mostrando onde o Turo expõe ganhos, recibos, avaliações e mensagens.
      </p>
    );
  }
  return (
    <div className="space-y-1.5">
      {entries.map(([url, val]) => {
        const ok = val !== null && typeof val === "object" && !("_nonjson" in (val as object));
        const isNum = typeof val === "number";
        const keys = ok ? Object.keys(val as object).slice(0, 8).join(", ") : "";
        return (
          <div key={url} className="flex items-start gap-2 text-xs font-mono border-b last:border-0 py-1">
            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${ok ? "bg-green-100 text-green-700" : isNum ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
              {ok ? "JSON" : isNum ? `HTTP ${val as number}` : "erro"}
            </span>
            <div className="min-w-0">
              <p className="truncate">{url}</p>
              {ok && <p className="text-muted-foreground truncate">{`{ ${keys} }`}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SyncTab({ config, connected, onChanged }: { config: TuroConfig | null; connected: boolean; onChanged: () => void }) {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedBookmark, setCopiedBookmark] = useState(false);
  const [generating, setGenerating] = useState(false);

  const bookmarklet = config?.sync_key ? buildScript({ key: config.sync_key }) : null;

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setSaving(true);
    try {
      const res = await authedFetch("/api/admin/turo/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bearer_token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      toast({ title: "Turo conectado!", description: data.host_name ? `Conta: ${data.host_name}` : "Token salvo." });
      setToken("");
      onChanged();
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncClick() {
    if (bookmarklet) { setScript(bookmarklet); return; }
    setGenerating(true);
    try {
      const res = await authedFetch("/api/admin/turo/sync-token", { method: "POST" });
      if (!res.ok) throw new Error("Não foi possível gerar token de sync");
      const { token: t } = await res.json() as { token: string };
      setScript(buildScript({ token: t }));
    } catch (e) {
      toast({ title: "Erro", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Desconectar o Turo? Os dados de viagens salvos serão mantidos.")) return;
    setDisconnecting(true);
    try {
      await authedFetch("/api/admin/turo/config", { method: "DELETE" });
      toast({ title: "Turo desconectado" });
      onChanged();
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image src="/turo-logo.png" alt="Turo" width={56} height={20} className="object-contain" /> Conectar conta Turo
          </CardTitle>
          <CardDescription>Cole o cookie header completo do turo.com (uma única vez).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm font-medium text-amber-800">Como obter os cookies:</p>
            </div>
            <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside ml-4">
              <li>Acesse <strong>turo.com</strong> e faça login</li>
              <li>Abra o DevTools (<strong>F12</strong>) → aba <strong>Network</strong>, recarregue</li>
              <li>Clique numa requisição para <strong>turo.com/api/</strong></li>
              <li>Em <strong>Request Headers</strong>, copie o valor de <strong>cookie</strong></li>
              <li>Cole abaixo (inclui cf_clearance, access_token, refresh_token)</li>
            </ol>
          </div>
          <form onSubmit={handleConnect} className="space-y-3">
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="cf_clearance=xxx; access_token=eyJ..." className="font-mono text-xs" required />
            <Button type="submit" disabled={saving || !token.trim()}>
              <Link2 className="mr-2 h-4 w-4" />{saving ? "Conectando..." : "Conectar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-1 rounded-lg bg-black"><Image src="/turo-logo.png" alt="Turo" width={60} height={22} className="object-contain" /></div>
          <div>
            <p className="font-semibold text-green-700">Conectado</p>
            <p className="text-xs text-muted-foreground">
              {config?.last_synced_at ? `Último sync: ${fmtDateTime(config.last_synced_at)}` : "Nunca sincronizado"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSyncClick} disabled={generating} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`} /> Sincronizar
          </Button>
          <Button onClick={handleDisconnect} disabled={disconnecting} size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10">
            <Link2Off className="mr-2 h-4 w-4" /> Desconectar
          </Button>
        </div>
      </div>

      {bookmarklet && (
        <Card className="border-indigo-200 bg-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-indigo-900 text-sm font-semibold"><Terminal className="h-4 w-4" /> Bookmarklet</CardTitle>
            <CardDescription className="text-indigo-700 text-xs">Arraste para os favoritos. No turo.com (logado), clique para sincronizar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <a href={bookmarklet} onClick={(e) => e.preventDefault()} draggable
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md cursor-grab select-none">
                <Image src="/turo-logo.png" alt="" width={32} height={12} className="object-contain brightness-0 invert" /> Sync Turo
              </a>
              <span className="text-xs text-indigo-600">← arraste para os favoritos</span>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => { await navigator.clipboard.writeText(bookmarklet); setCopiedBookmark(true); setTimeout(() => setCopiedBookmark(false), 2000); }}>
                {copiedBookmark ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}{copiedBookmark ? "Copiado!" : "Copiar link"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {script && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-900 text-base"><Terminal className="h-5 w-5" /> Executar Sync Agora</CardTitle>
            <CardDescription className="text-blue-700">Cole no console do turo.com (F12 → Console):</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">{script}</pre>
              <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={async () => { await navigator.clipboard.writeText(script); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}<span className="ml-1">{copied ? "Copiado!" : "Copiar"}</span>
              </Button>
            </div>
            <Button onClick={() => { setScript(null); onChanged(); }} size="sm"><Check className="mr-2 h-4 w-4" /> Já executei — Atualizar dados</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Descoberta de endpoints</CardTitle>
          <CardDescription className="text-xs">Resultado da última sondagem — onde o Turo expõe ganhos, recibos, avaliações e mensagens.</CardDescription>
        </CardHeader>
        <CardContent>
          <DiscoveryPanel probe={(config?.probe_data as ProbeData) ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
