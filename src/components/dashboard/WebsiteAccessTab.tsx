"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authedFetch } from "@/lib/admin-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Loader2, Globe, FileText, MousePointerClick, Settings2, ExternalLink, Radio } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

type DailyRow = { date: string; sessions: number; activeUsers: number };
type Engagement = { avgSessionDuration: number; bounceRate: number; pagesPerSession: number };
type SourceRow = { source: string; sessions: number };
type PageRow = { path: string; views: number };
type GeoRow = { country: string; sessions: number };
type ButtonRow = { label: string; clicks: number };

type Report = {
  sessions: number;
  activeUsers: number;
  daily: DailyRow[];
  engagement: Engagement;
  sources: SourceRow[];
  pages: PageRow[];
  geography: GeoRow[];
  buttonClicks: ButtonRow[];
  buttonClicksError: string | null;
  previous: { sessions: number; activeUsers: number } | null;
};

type SalesTotals = { revenue: number; bookings: number };

const fmtUSD = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function fmtDateRange(start: Date, end: Date) {
  return `${format(start, "d 'de' MMM", { locale: ptBR })} - ${format(end, "d 'de' MMM 'de' yyyy", { locale: ptBR })}`;
}

/** null means "no baseline to compare against" — rendered as no badge rather than a misleading 0%/∞. */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const isUp = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-green-600" : "text-red-500"}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function StatTile({ label, value, pct }: { label: string; value: string; pct: number | null }) {
  return (
    <div className="p-3 rounded-lg border bg-muted/30">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-xl font-bold">{value}</span>
        <ChangeBadge pct={pct} />
      </div>
    </div>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

const sessionsChartConfig = { sessions: { label: "Sessões", color: "hsl(var(--primary))" } };

type Period = 1 | 7 | 30;

async function loadGa4(d: Period): Promise<Report> {
  const res = await authedFetch(`/api/google-cloud/website-analytics?days=${d}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro ao carregar analytics");
  return data;
}

// Bookings are our own ground truth (Supabase), not GA4's ecommerce tracking — the site
// never sends purchase/booking events to GA4, only to the Facebook Pixel — so pulling
// these two numbers from GA4 would just show $0. Every booking comes from the site's own
// "Request to Book" flow (there's no other channel), so no filter is needed beyond the
// date range; cancelled bookings never happened as far as this is concerned.
async function loadSales(d: Period): Promise<{ current: SalesTotals; previous: SalesTotals }> {
  const cStart = format(subDays(new Date(), d - 1), "yyyy-MM-dd");
  const cEnd = format(new Date(), "yyyy-MM-dd");
  const pStart = format(subDays(new Date(), d * 2 - 1), "yyyy-MM-dd");
  const pEnd = format(subDays(new Date(), d), "yyyy-MM-dd");

  const [curRes, prevRes] = await Promise.all([
    supabase.from("bookings").select("estimated_total").neq("status", "cancelled").gte("pickup_date", cStart).lte("pickup_date", cEnd),
    supabase.from("bookings").select("estimated_total").neq("status", "cancelled").gte("pickup_date", pStart).lte("pickup_date", pEnd),
  ]);

  const sum = (rows: { estimated_total: number | null }[] | null) => (rows ?? []).reduce((s, b) => s + (Number(b.estimated_total) || 0), 0);
  return {
    current: { revenue: sum(curRes.data), bookings: (curRes.data ?? []).length },
    previous: { revenue: sum(prevRes.data), bookings: (prevRes.data ?? []).length },
  };
}

type RealtimeSnapshot = {
  activeUsers: number;
  byPage: { page: string; users: number }[];
  byCountry: { country: string; users: number }[];
};

/** Polls the GA4 Realtime Data API every 20s — separate endpoint/cadence from the
 *  period report so switching between "Hoje/7/30 dias" never disturbs this widget. */
function LiveVisitorsWidget() {
  const [snapshot, setSnapshot] = useState<RealtimeSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      authedFetch("/api/google-cloud/website-analytics/realtime")
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (cancelled) return;
          if (ok) { setSnapshot(data); setFailed(false); }
          else setFailed(true);
        })
        .catch(() => { if (!cancelled) setFailed(true); });
    }
    poll();
    const interval = setInterval(poll, 20000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (failed) return null;

  return (
    <Card className="border-green-200 dark:border-green-900">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          Agora no site
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!snapshot ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-3xl font-bold">{snapshot.activeUsers}</p>
              <p className="text-xs text-muted-foreground">visitante(s) ativo(s)</p>
            </div>
            {snapshot.byPage.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Radio className="h-3 w-3" /> Páginas agora</p>
                <div className="space-y-0.5">
                  {snapshot.byPage.slice(0, 5).map((p) => (
                    <div key={p.page} className="flex justify-between text-sm gap-2">
                      <span className="truncate">{p.page}</span>
                      <span className="font-medium shrink-0">{p.users}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {snapshot.byCountry.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Globe className="h-3 w-3" /> Locais agora</p>
                <div className="space-y-0.5">
                  {snapshot.byCountry.slice(0, 5).map((c) => (
                    <div key={c.country} className="flex justify-between text-sm gap-2">
                      <span className="truncate">{c.country}</span>
                      <span className="font-medium shrink-0">{c.users}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function WebsiteAccessTab() {
  const [days, setDays] = useState<Period>(30);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sales, setSales] = useState<{ current: SalesTotals; previous: SalesTotals } | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");

  const today = new Date();
  const previousStart = subDays(today, days * 2 - 1);
  const previousEnd = subDays(today, days);

  function fetchAll(d: Period) {
    Promise.all([loadGa4(d), loadSales(d)])
      .then(([ga4, salesData]) => { setReport(ga4); setSales(salesData); })
      .catch((e) => { setError(e instanceof Error ? e.message : "Falha ao carregar analytics"); setReport(null); })
      .finally(() => setLoading(false));
  }

  // loading/error already start at their "about to fetch" defaults (true / ""), so the
  // mount effect can kick the fetch off without any setState call of its own.
  useEffect(() => { fetchAll(30); }, []);

  function handleDaysChange(v: string) {
    const d = Number(v) as Period;
    setDays(d);
    setLoading(true);
    setError("");
    fetchAll(d);
  }

  async function handleSetupClickTracking() {
    setSettingUp(true);
    setSetupMessage("");
    try {
      const res = await authedFetch("/api/google-cloud/website-analytics/setup-click-tracking", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSetupMessage(data.error || "Falha ao configurar");
        return;
      }
      setSetupMessage(
        data.alreadyExisted
          ? "Já estava configurado — os cliques novos devem aparecer em breve."
          : "Configurado! Os cliques a partir de agora já vão ser contados (cliques antigos não são retroativos)."
      );
      loadGa4(days).then(setReport).catch(() => {});
    } catch {
      setSetupMessage("Falha na conexão");
    } finally {
      setSettingUp(false);
    }
  }

  const maxSource = report ? Math.max(1, ...report.sources.map((s) => s.sessions)) : 1;
  const maxPage = report ? Math.max(1, ...report.pages.map((p) => p.views)) : 1;
  const maxGeo = report ? Math.max(1, ...report.geography.map((g) => g.sessions)) : 1;
  const maxButton = report ? Math.max(1, ...report.buttonClicks.map((b) => b.clicks)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(days)} onValueChange={handleDaysChange}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Hoje</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          em comparação com o período anterior ({fmtDateRange(previousStart, previousEnd)})
        </span>
      </div>

      <LiveVisitorsWidget />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <div className="mt-1">
              <a href="/admin/automations/google-cloud/traffic" className="inline-flex items-center gap-1 underline text-xs">
                Configurar GA4 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : report ? (
        <>
          <Card>
            <CardHeader><CardTitle>Principais estatísticas</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile
                  label="Sessões do site"
                  value={report.sessions.toLocaleString("pt-BR")}
                  pct={report.previous ? pctChange(report.sessions, report.previous.sessions) : null}
                />
                <StatTile
                  label="Receita de reservas"
                  value={sales ? fmtUSD(sales.current.revenue) : "—"}
                  pct={sales ? pctChange(sales.current.revenue, sales.previous.revenue) : null}
                />
                <StatTile
                  label="Total de reservas"
                  value={sales ? sales.current.bookings.toLocaleString("pt-BR") : "—"}
                  pct={sales ? pctChange(sales.current.bookings, sales.previous.bookings) : null}
                />
                <StatTile
                  label="Visitantes únicos"
                  value={report.activeUsers.toLocaleString("pt-BR")}
                  pct={report.previous ? pctChange(report.activeUsers, report.previous.activeUsers) : null}
                />
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-base font-semibold mb-3">Conheça seus visitantes</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Sessões ao longo do tempo</CardTitle></CardHeader>
                <CardContent>
                  {report.daily.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no período</p>
                  ) : (
                    <ChartContainer config={sessionsChartConfig} className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={report.daily}>
                          <defs>
                            <linearGradient id="sessionsFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                            tickFormatter={(d: string) => format(new Date(`${d}T00:00:00`), "d/M")} />
                          <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area type="monotone" dataKey="sessions" stroke="var(--color-sessions)" strokeWidth={2} fill="url(#sessionsFill)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Principais fontes de tráfego</CardTitle></CardHeader>
                <CardContent>
                  {report.sources.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no período</p>
                  ) : (
                    <div className="space-y-3">
                      {report.sources.map((s) => (
                        <div key={s.source}>
                          <div className="flex justify-between text-sm"><span>{s.source}</span><span className="font-medium">{s.sessions.toLocaleString("pt-BR")}</span></div>
                          <Bar value={s.sessions} max={maxSource} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Sessões por local</CardTitle></CardHeader>
                <CardContent>
                  {report.geography.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no período</p>
                  ) : (
                    <div className="space-y-3">
                      {report.geography.map((g) => (
                        <div key={g.country}>
                          <div className="flex justify-between text-sm"><span>{g.country}</span><span className="font-medium">{g.sessions.toLocaleString("pt-BR")}</span></div>
                          <Bar value={g.sessions} max={maxGeo} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold mb-3">Explorar engajamento dos visitantes</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Páginas mais visitadas por sessões</CardTitle></CardHeader>
                <CardContent>
                  {report.pages.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Sem dados no período</p>
                  ) : (
                    <div className="space-y-3">
                      {report.pages.map((p) => (
                        <div key={p.path}>
                          <div className="flex justify-between text-sm gap-2"><span className="truncate">{p.path}</span><span className="font-medium shrink-0">{p.views.toLocaleString("pt-BR")}</span></div>
                          <Bar value={p.views} max={maxPage} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Estatísticas de engajamento</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Média de páginas por sessão</span>
                    <span className="text-lg font-bold">{report.engagement.pagesPerSession.toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Duração média da sessão</span>
                    <span className="text-lg font-bold">{fmtDuration(report.engagement.avgSessionDuration)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Taxa de rejeição</span>
                    <span className="text-lg font-bold">{(report.engagement.bounceRate * 100).toFixed(1)}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><MousePointerClick className="h-4 w-4" /> Botões mais clicados</CardTitle></CardHeader>
                <CardContent>
                  {report.buttonClicksError || report.buttonClicks.length === 0 ? (
                    <div className="space-y-3 py-2">
                      <p className="text-sm text-muted-foreground">
                        {report.buttonClicksError
                          ? "O rastreamento de cliques ainda não está configurado no GA4."
                          : "Nenhum botão clicado nesse período."}
                      </p>
                      {report.buttonClicksError && (
                        <>
                          <Button size="sm" variant="outline" onClick={handleSetupClickTracking} disabled={settingUp}>
                            {settingUp ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Settings2 className="h-3.5 w-3.5 mr-1.5" />}
                            Configurar rastreamento de cliques
                          </Button>
                          {setupMessage && <p className="text-xs text-muted-foreground">{setupMessage}</p>}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.buttonClicks.map((b) => (
                        <div key={b.label}>
                          <div className="flex justify-between text-sm gap-2"><span className="truncate">{b.label}</span><span className="font-medium shrink-0">{b.clicks.toLocaleString("pt-BR")}</span></div>
                          <Bar value={b.clicks} max={maxButton} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
