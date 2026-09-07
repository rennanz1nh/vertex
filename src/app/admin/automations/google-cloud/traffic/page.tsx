"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, TrendingUp, Globe, FileText, MousePointerClick, Settings2 } from "lucide-react";
import { GoogleCloudAutomationTabs } from "@/components/google-cloud/GoogleCloudAutomationTabs";
import { GoogleCloudLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

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
};

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function WebsiteAnalyticsPage() {
  const [days, setDays] = useState<7 | 30>(30);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [settingUp, setSettingUp] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");

  const fetchReport = useCallback(async (d: 7 | 30) => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch(`/api/google-cloud/website-analytics?days=${d}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar analytics");
        setReport(null);
        return;
      }
      setReport(data);
    } catch {
      setError("Falha na conexão ao carregar analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(days); }, [days, fetchReport]);

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
      fetchReport(days);
    } catch {
      setSetupMessage("Falha na conexão");
    } finally {
      setSettingUp(false);
    }
  }

  const maxDaily = report ? Math.max(1, ...report.daily.map((d) => d.sessions)) : 1;
  const maxSource = report ? Math.max(1, ...report.sources.map((s) => s.sessions)) : 1;
  const maxPage = report ? Math.max(1, ...report.pages.map((p) => p.views)) : 1;
  const maxGeo = report ? Math.max(1, ...report.geography.map((g) => g.sessions)) : 1;
  const maxButton = report ? Math.max(1, ...report.buttonClicks.map((b) => b.clicks)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleCloudLogo className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Sessões, visitantes, fontes de tráfego, páginas, engajamento e cliques do site — direto da GA4 Data API.
          </p>
        </div>
      </div>

      <GoogleCloudAutomationTabs />

      <div className="flex items-center gap-2">
        {([7, 30] as const).map((d) => (
          <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)} type="button">
            {d} dias
          </Button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sessões</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{report.sessions.toLocaleString("pt-BR")}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Visitantes únicos</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{report.activeUsers.toLocaleString("pt-BR")}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Duração média</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{fmtDuration(report.engagement.avgSessionDuration)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Taxa de rejeição</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{(report.engagement.bounceRate * 100).toFixed(1)}%</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Páginas/sessão</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{report.engagement.pagesPerSession.toFixed(1)}</div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Sessões por dia</CardTitle>
              <CardDescription>Últimos {days} dias, fuso horário da propriedade GA4.</CardDescription>
            </CardHeader>
            <CardContent>
              {report.daily.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Sem dados no período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium">Data</th>
                        <th className="text-right py-2 px-2 font-medium">Sessões</th>
                        <th className="text-right py-2 px-2 font-medium">Visitantes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.daily.map((row) => (
                        <tr key={row.date} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">{fmtDate(row.date)}</td>
                          <td className="py-2 px-2 text-right">{row.sessions.toLocaleString("pt-BR")}</td>
                          <td className="py-2 px-2 text-right">{row.activeUsers.toLocaleString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Páginas mais visitadas</CardTitle></CardHeader>
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
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Sessões por país</CardTitle></CardHeader>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><MousePointerClick className="h-4 w-4" /> Botões mais clicados</CardTitle>
              </CardHeader>
              <CardContent>
                {report.buttonClicksError || report.buttonClicks.length === 0 ? (
                  <div className="space-y-3 py-2">
                    <p className="text-sm text-muted-foreground">
                      {report.buttonClicksError
                        ? "O rastreamento de cliques ainda não está configurado no GA4."
                        : "Nenhum clique registrado ainda — se acabou de configurar, aguarde alguns cliques reais no site."}
                    </p>
                    <Button size="sm" variant="outline" onClick={handleSetupClickTracking} disabled={settingUp}>
                      {settingUp ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Settings2 className="h-3.5 w-3.5 mr-1.5" />}
                      Configurar rastreamento de cliques
                    </Button>
                    {setupMessage && <p className="text-xs text-muted-foreground">{setupMessage}</p>}
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
        </>
      ) : null}
    </div>
  );
}
