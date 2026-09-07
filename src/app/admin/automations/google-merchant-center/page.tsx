"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, AlertTriangle, ShieldAlert, Tag, ExternalLink, Info } from "lucide-react";
import { GoogleMerchantCenterLogo } from "@/components/brand-logos";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";

type AccountIssue = {
  name: string;
  title: string;
  severity: string;
  detail: string;
  documentationUri: string | null;
  impactedDestinations: string[];
};

type AggregateProductStatusIssue = {
  severity: string;
  attribute: string | null;
  documentationUri: string | null;
  productCount: number;
};

type AggregateProductStatus = {
  reportingContext: string;
  country: string;
  itemLevelIssues: AggregateProductStatusIssue[];
};

type Promotion = {
  promotionId: string;
  title: string | null;
  redemptionChannel: string[];
  targetCountry: string | null;
  startTime: string | null;
  endTime: string | null;
};

type MerchantCenterData = {
  issues: AccountIssue[];
  issuesError: string | null;
  statuses: AggregateProductStatus[];
  statusesError: string | null;
  promotions: Promotion[];
  promotionsError: string | null;
};

function severityBadge(severity: string) {
  const s = severity.toUpperCase();
  if (s === "CRITICAL" || s === "ERROR") {
    return <Badge variant="destructive">{severity}</Badge>;
  }
  if (s === "SUGGESTION" || s === "WARNING") {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-300">{severity}</Badge>;
  }
  return <Badge variant="outline">{severity}</Badge>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

export default function GoogleMerchantCenterPage() {
  const { toast } = useToast();
  const [data, setData] = useState<MerchantCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await authedFetch("/api/google-merchant-center");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Erro ao carregar dados do Merchant Center");
        setData(null);
        return;
      }
      setData(body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: "Erro ao carregar", description: msg, variant: "destructive" });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalIssueProducts = (data?.statuses ?? []).reduce(
    (sum, s) => sum + s.itemLevelIssues.reduce((a, i) => a + i.productCount, 0),
    0
  );

  const promotionsNotEnabled = !!data?.promotionsError?.includes("programa de Promoções do Google não está habilitado");

  return (
    <div className="space-y-6">
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GoogleMerchantCenterLogo className="h-10 w-10 shrink-0" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Google Merchant Center</h1>
              <p className="text-muted-foreground mt-1">
                Saúde da conta, resumo de status dos produtos e promoções — direto da conta do Google Merchant Center.
              </p>
            </div>
          </div>
          <Button onClick={fetchData} disabled={refreshing} size="sm" variant="outline">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Atualizar
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            {/* Account-level issues */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Problemas na conta</CardTitle>
                </div>
                <CardDescription>
                  Problemas no nível da conta inteira (suspensões, violações de política, dados de contato/site) —
                  diferente dos problemas por produto, que ficam na aba Status do Google Shopping.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.issuesError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{data.issuesError}</AlertDescription>
                  </Alert>
                ) : data.issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    Nenhum problema de conta encontrado — sinal positivo, sem restrições ativas.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {data.issues.map((issue) => (
                      <div key={issue.name || issue.title} className="border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{issue.title}</p>
                          {severityBadge(issue.severity)}
                          {issue.impactedDestinations.map((d) => (
                            <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
                          ))}
                        </div>
                        {issue.detail && <p className="text-sm text-muted-foreground">{issue.detail}</p>}
                        {issue.documentationUri && (
                          <a
                            href={issue.documentationUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            Ver como resolver <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aggregate product status */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo de status dos produtos</CardTitle>
                <CardDescription>
                  Contagem de produtos afetados por tipo de problema, por canal e país — a visão consolidada que a
                  aba Status do Google Shopping (por produto) não mostra de forma agregada.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.statusesError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{data.statusesError}</AlertDescription>
                  </Alert>
                ) : data.statuses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhum dado de resumo disponível ainda.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="text-2xl font-bold">
                      {totalIssueProducts}{" "}
                      <span className="text-sm font-normal text-muted-foreground">produtos com algum problema reportado</span>
                    </div>
                    {data.statuses.map((s) => (
                      <div key={`${s.reportingContext}-${s.country}`} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{s.reportingContext}</Badge>
                          <span className="text-xs text-muted-foreground">{s.country}</span>
                        </div>
                        {s.itemLevelIssues.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem problemas reportados neste canal/país.</p>
                        ) : (
                          <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <tbody>
                              {s.itemLevelIssues.map((issue, i) => (
                                <tr key={i} className="border-t">
                                  <td className="py-1.5 pr-2">{severityBadge(issue.severity)}</td>
                                  <td className="py-1.5 pr-2 text-muted-foreground">{issue.attribute ?? "—"}</td>
                                  <td className="py-1.5 pr-2 text-right font-medium">{issue.productCount} produto(s)</td>
                                  <td className="py-1.5 text-right">
                                    {issue.documentationUri && (
                                      <a
                                        href={issue.documentationUri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                      >
                                        Resolver <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Promotions */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-muted-foreground" />
                  <CardTitle>Promoções</CardTitle>
                </div>
                <CardDescription>
                  Promoções configuradas na conta do Merchant Center. Criação de novas promoções por aqui ainda não
                  está disponível — a documentação do Google para esse envio específico não pôde ser totalmente
                  confirmada, então por enquanto esta seção é somente leitura para evitar submeter algo incorreto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.promotionsError ? (
                  <Alert variant={promotionsNotEnabled ? "default" : "destructive"}>
                    {promotionsNotEnabled ? <Info className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <AlertDescription>{data.promotionsError}</AlertDescription>
                  </Alert>
                ) : data.promotions.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">Nenhuma promoção configurada nesta conta.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 font-medium">Título</th>
                          <th className="text-left py-2 px-2 font-medium">ID</th>
                          <th className="text-left py-2 px-2 font-medium">Canal</th>
                          <th className="text-left py-2 px-2 font-medium">País</th>
                          <th className="text-left py-2 px-2 font-medium">Início</th>
                          <th className="text-left py-2 px-2 font-medium">Fim</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.promotions.map((p) => (
                          <tr key={p.promotionId} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-2 font-medium">{p.title ?? "—"}</td>
                            <td className="py-2 px-2 text-muted-foreground">{p.promotionId}</td>
                            <td className="py-2 px-2">{p.redemptionChannel.join(", ") || "—"}</td>
                            <td className="py-2 px-2">{p.targetCountry ?? "—"}</td>
                            <td className="py-2 px-2">{fmtDate(p.startTime)}</td>
                            <td className="py-2 px-2">{fmtDate(p.endTime)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
