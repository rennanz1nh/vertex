"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, RefreshCw, Send, Search, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { SearchConsoleAutomationTabs } from "@/components/search-console/SearchConsoleAutomationTabs";
import { SearchConsoleStatusCard } from "@/components/search-console/SearchConsoleStatusCard";
import { GoogleSearchConsoleLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type SitemapInfo = {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  errors?: number;
  warnings?: number;
  contents?: { type: string; submitted: number; indexed: number }[];
};

type InspectionResult = {
  indexStatusResult?: {
    verdict?: string;
    coverageState?: string;
    robotsTxtState?: string;
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
  };
  richResultsResult?: {
    verdict?: string;
    detectedItems?: { richResultType?: string }[];
  };
};

function VerdictBadge({ verdict }: { verdict?: string }) {
  if (!verdict) return null;
  if (verdict === "PASS") {
    return <Badge className="bg-green-600 hover:bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Indexada</Badge>;
  }
  if (verdict === "FAIL") {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Não indexada</Badge>;
  }
  return <Badge variant="outline" className="gap-1"><HelpCircle className="h-3 w-3" /> {verdict}</Badge>;
}

export default function SearchConsoleIndexingPage() {
  const [sitemaps, setSitemaps] = useState<SitemapInfo[] | null>(null);
  const [sitemapsLoading, setSitemapsLoading] = useState(true);
  const [sitemapsError, setSitemapsError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [inspectUrl, setInspectUrl] = useState("https://vertexrentalcars.com/");
  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState<InspectionResult | null>(null);
  const [inspectError, setInspectError] = useState("");

  const fetchSitemaps = useCallback(async () => {
    setSitemapsLoading(true);
    setSitemapsError("");
    try {
      const res = await authedFetch("/api/search-console/sitemaps");
      const data = await res.json();
      if (!res.ok) {
        setSitemapsError(data.error || "Erro ao carregar sitemaps");
        return;
      }
      setSitemaps(data.sitemaps);
    } catch {
      setSitemapsError("Falha na conexão ao carregar sitemaps");
    } finally {
      setSitemapsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSitemaps(); }, [fetchSitemaps]);

  async function handleResubmit() {
    setSubmitting(true);
    try {
      const res = await authedFetch("/api/search-console/sitemaps", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSitemapsError(data.error || "Erro ao reenviar sitemap");
        return;
      }
      await fetchSitemaps();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInspect() {
    setInspecting(true);
    setInspectError("");
    setInspectResult(null);
    try {
      const res = await authedFetch("/api/search-console/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inspectUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInspectError(data.error || "Erro ao inspecionar URL");
        return;
      }
      setInspectResult(data.result);
    } catch {
      setInspectError("Falha na conexão ao inspecionar URL");
    } finally {
      setInspecting(false);
    }
  }

  const status = inspectResult?.indexStatusResult;
  const richResults = inspectResult?.richResultsResult;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleSearchConsoleLogo className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Search Console — Indexação</h1>
          <p className="text-muted-foreground text-sm">
            Status do sitemap enviado e inspeção de URLs específicas (se estão indexadas, quando foram
            rastreadas, e o que o Google acha do dado estruturado).
          </p>
        </div>
      </div>

      <SearchConsoleAutomationTabs />
      <SearchConsoleStatusCard />

      <Card>
        <CardHeader>
          <CardTitle>Sitemap</CardTitle>
          <CardDescription>sitemap.xml gerado automaticamente pelo site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sitemapsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{sitemapsError}</AlertDescription>
            </Alert>
          )}

          {sitemapsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : sitemaps && sitemaps.length > 0 ? (
            <div className="space-y-3">
              {sitemaps.map((s) => (
                <div key={s.path} className="border rounded-lg p-3 space-y-1.5">
                  <p className="font-mono text-xs break-all">{s.path}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {s.lastSubmitted && <span>Enviado: {new Date(s.lastSubmitted).toLocaleString("pt-BR")}</span>}
                    {s.lastDownloaded && <span>· Baixado: {new Date(s.lastDownloaded).toLocaleString("pt-BR")}</span>}
                    {s.isPending && <Badge variant="outline">Pendente</Badge>}
                    {!!s.errors && <Badge variant="destructive">{s.errors} erro(s)</Badge>}
                    {!!s.warnings && <Badge variant="outline">{s.warnings} aviso(s)</Badge>}
                  </div>
                  {s.contents && s.contents.length > 0 && (
                    <div className="flex flex-wrap gap-3 text-xs pt-1">
                      {s.contents.map((c, i) => (
                        <span key={i} className="text-muted-foreground">
                          {c.type}: {c.indexed}/{c.submitted} indexadas
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum sitemap enviado ainda no Search Console. Clique em &quot;Enviar sitemap&quot; abaixo.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSitemaps} disabled={sitemapsLoading} className="gap-1.5" type="button">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
            <Button size="sm" onClick={handleResubmit} disabled={submitting} className="gap-1.5 bg-black hover:bg-black/80 text-white" type="button">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar sitemap
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inspecionar URL</CardTitle>
          <CardDescription>Confirma se uma página específica está indexada pelo Google e quando foi rastreada pela última vez</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={inspectUrl}
              onChange={(e) => setInspectUrl(e.target.value)}
              placeholder="https://vertexrentalcars.com/products/..."
              onKeyDown={(e) => e.key === "Enter" && handleInspect()}
            />
            <Button onClick={handleInspect} disabled={inspecting} className="gap-1.5 bg-black hover:bg-black/80 text-white shrink-0" type="button">
              {inspecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Inspecionar
            </Button>
          </div>

          {inspectError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{inspectError}</AlertDescription>
            </Alert>
          )}

          {status && (
            <div className="border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <VerdictBadge verdict={status.verdict} />
              </div>
              {status.coverageState && (
                <p><span className="font-medium">Cobertura:</span> {status.coverageState}</p>
              )}
              {status.lastCrawlTime && (
                <p><span className="font-medium">Último rastreio:</span> {new Date(status.lastCrawlTime).toLocaleString("pt-BR")}</p>
              )}
              {status.pageFetchState && (
                <p><span className="font-medium">Busca da página:</span> {status.pageFetchState}</p>
              )}
              {status.robotsTxtState && (
                <p><span className="font-medium">robots.txt:</span> {status.robotsTxtState}</p>
              )}
              {status.indexingState && (
                <p><span className="font-medium">Permissão de indexação:</span> {status.indexingState}</p>
              )}
              {status.googleCanonical && (
                <p><span className="font-medium">Canônica escolhida pelo Google:</span> <span className="font-mono text-xs break-all">{status.googleCanonical}</span></p>
              )}
            </div>
          )}

          {richResults && (
            <div className="border rounded-lg p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Dados estruturados (rich results):</span>
                <VerdictBadge verdict={richResults.verdict} />
              </div>
              {richResults.detectedItems && richResults.detectedItems.length > 0 && (
                <p className="text-muted-foreground">
                  Tipos detectados: {richResults.detectedItems.map((d) => d.richResultType).filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
