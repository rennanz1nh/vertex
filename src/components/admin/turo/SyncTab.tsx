import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";
import { Link2, Link2Off, AlertCircle, Copy, Check, Terminal, RefreshCw } from "lucide-react";
import { TuroConfig, fmtDateTime } from "./shared";

// Fetches the real Turo host endpoints (confirmed via network sniffer) same-origin on
// turo.com — earnings, reviews, structured feedback, payout — and sends them to
// browser-sync, which stores them for the Ganhos / Avaliações / Métodos tabs.
const FETCH_EXTRAS = `let hid=null;try{const ff=(h.tripHistoryFeeds&&(h.tripHistoryFeeds.list||h.tripHistoryFeeds))||[];for(const m of ff){if(m.trips&&m.trips[0]){hid=m.trips[0].owner&&m.trips[0].owner.id;break;}}}catch(e){}const yr=new Date().getFullYear();const gj=async(u)=>{try{const r=await fetch(u);return r.ok?await r.json():{_status:r.status};}catch(e){return {_error:String(e)};}};const earnings={hostId:hid,years:{}};earnings.years[yr]=await gj('/api/me/earnings/summaries/list?year='+yr);earnings.years[yr-1]=await gj('/api/me/earnings/summaries/list?year='+(yr-1));if(hid){earnings.scorecard=await gj('/api/drivers/'+hid+'/owner-scorecard/earnings');}const payout=await gj('/api/me/payout/method');const reviews=hid?await gj('/api/drivers/'+hid+'/host-feedback?days=365&itemsPerPage=50&page=1&sortOrder=MOST_RECENT'):null;const feedback=hid?await gj('/api/drivers/'+hid+'/host-scorecard/structured-feedback?days=365&sortOrder=MOST_RECENT'):null;let rid=null;try{const el=(earnings.years[yr]&&earnings.years[yr].ownerEarningsList)||[];for(const x of el){if(x.reservation&&x.reservation.reservationId&&x.reservation.reservationReceiptIsAvailable){rid=x.reservation.reservationId;break;}}}catch(e){}const probe={reservationId:rid,results:{}};if(rid){for(const pu of ['/api/reservation/'+rid+'/cost','/api/reservation/'+rid+'/receipt','/api/reservations/'+rid+'/receipt','/api/v2/reservation/'+rid+'/receipt','/api/reservation/'+rid+'/owner-receipt','/api/reservations/'+rid+'/owner-receipt','/api/reservation/'+rid+'/host-receipt','/api/v2/reservations/'+rid+'/cost']){probe.results[pu]=await gj(pu);}}`;

function buildScript(auth: { key?: string; token?: string }, asBookmarklet = false) {
  const header = auth.key ? `'X-Sync-Key':'${auth.key}'` : `'X-Sync-Token':'${auth.token}'`;
  const body = `(async()=>{try{const[u,h]=await Promise.all([fetch('/api/v2/feeds/upcoming-trips?appMode=HOST').then(r=>r.json()),fetch('/api/v2/feeds/trip-history?driverRoles=HOST').then(r=>r.json())]);${FETCH_EXTRAS}const r=await fetch('https://vertexrentalcar.com/api/admin/turo/browser-sync',{method:'POST',headers:{'Content-Type':'application/json',${header}},body:JSON.stringify({upcomingData:u,historyData:h,earnings:earnings,reviews:reviews,feedback:feedback,payout:payout,probe:probe})});const d=await r.json();alert(d.synced>0?'✅ '+d.synced+' viagens + ganhos/avaliações sincronizados!':'⚠️ '+JSON.stringify(d));}catch(e){alert('❌ '+e);}})();`;
  return asBookmarklet ? `javascript:${body}` : body;
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

  const bookmarklet = config?.sync_key ? buildScript({ key: config.sync_key }, true) : null;

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
    // Console script (no javascript: prefix) — the reliable path, since turo.com's
    // CSP blocks javascript: bookmarklets.
    if (config?.sync_key) { setScript(buildScript({ key: config.sync_key }, false)); return; }
    setGenerating(true);
    try {
      const res = await authedFetch("/api/admin/turo/sync-token", { method: "POST" });
      if (!res.ok) throw new Error("Não foi possível gerar token de sync");
      const { token: t } = await res.json() as { token: string };
      setScript(buildScript({ token: t }, false));
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
            <CardTitle className="flex items-center gap-2 text-indigo-900 text-sm font-semibold"><Terminal className="h-4 w-4" /> Bookmarklet (opcional)</CardTitle>
            <CardDescription className="text-indigo-700 text-xs">Arraste para os favoritos e clique no turo.com. ⚠️ O turo.com às vezes bloqueia bookmarklets — se clicar e nada acontecer, use o botão <strong>Sincronizar</strong> acima (cola no console, sempre funciona).</CardDescription>
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
            <CardDescription className="text-blue-700">Copie, abra o turo.com (logado), aperte <strong>F12 → Console</strong>, cole e <strong>Enter</strong>. Deve aparecer um alerta de sucesso.</CardDescription>
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
          <CardTitle className="text-sm font-semibold">Dados do host</CardTitle>
          <CardDescription className="text-xs">Ganhos, avaliações e método de pagamento são capturados junto com as viagens.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {config?.host_data_synced_at
              ? `Última captura: ${fmtDateTime(config.host_data_synced_at)}. Veja em Ganhos, Avaliações e Métodos.`
              : "Ainda não capturado. Rode uma sincronização para preencher as abas Ganhos, Avaliações e Métodos."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
