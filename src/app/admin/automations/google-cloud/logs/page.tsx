"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, RefreshCw, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { GoogleCloudAutomationTabs } from "@/components/google-cloud/GoogleCloudAutomationTabs";
import { GoogleCloudLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type LogSource = "ebay" | "amazon" | "google-shopping";

type LogEntry = {
  id: string;
  source: LogSource;
  created_at: string;
  trigger: string;
  mode: string;
  status: string;
  total: number | null;
  updated: number | null;
  error: string | null;
};

const SOURCE_LABEL: Record<LogSource, string> = {
  ebay: "eBay",
  amazon: "Amazon",
  "google-shopping": "Google Shopping",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "success") {
    return <Badge className="bg-green-600 hover:bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Sucesso</Badge>;
  }
  if (status === "blocked") {
    return <Badge variant="outline" className="gap-1 text-amber-700 border-amber-300"><ShieldAlert className="h-3 w-3" /> Bloqueado</Badge>;
  }
  return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
}

const SOURCES: LogSource[] = ["ebay", "amazon", "google-shopping"];

export default function GoogleCloudLogsPage() {
  const [entries, setEntries] = useState<LogEntry[] | null>(null);
  const [unavailable, setUnavailable] = useState<LogSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sourceFilter, setSourceFilter] = useState<LogSource | "all">("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authedFetch("/api/google-cloud/logs?limit=100");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao carregar logs");
        return;
      }
      setEntries(data.entries);
      setUnavailable(data.unavailable ?? []);
    } catch {
      setError("Falha na conexão ao carregar logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = entries?.filter((e) => sourceFilter === "all" || e.source === sourceFilter) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleCloudLogo className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Cloud Console — Logs</h1>
          <p className="text-muted-foreground text-sm">
            Equivalente funcional ao Cloud Logging: histórico unificado das automações (eBay, Amazon,
            Google Shopping), já guardado no Supabase — não precisa de um sink no GCP pra isso funcionar.
          </p>
        </div>
      </div>

      <GoogleCloudAutomationTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {unavailable.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Sem tabela de logs disponível para: {unavailable.map((s) => SOURCE_LABEL[s]).join(", ")}.
            {unavailable.includes("amazon") && " A integração Amazon ainda não teve suas tabelas aplicadas no banco."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-1.5">
          {(["all", ...SOURCES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSourceFilter(s)}
              className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors ${
                sourceFilter === s ? "bg-black text-white border-black" : "bg-background text-muted-foreground border-input hover:bg-muted"
              }`}
            >
              {s === "all" ? "Todos" : SOURCE_LABEL[s]}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="gap-1.5" type="button">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execuções recentes</CardTitle>
          <CardDescription>Mais recentes primeiro, até 100 registros por fonte</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum registro encontrado.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Quando</th>
                    <th className="text-left p-3 font-medium">Fonte</th>
                    <th className="text-left p-3 font-medium">Gatilho</th>
                    <th className="text-left p-3 font-medium">Modo</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Atualizados</th>
                    <th className="text-left p-3 font-medium">Detalhe</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={`${e.source}-${e.id}`} className="border-t align-top">
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3 whitespace-nowrap">{SOURCE_LABEL[e.source]}</td>
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{e.trigger}</td>
                      <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">{e.mode}</td>
                      <td className="p-3"><StatusBadge status={e.status} /></td>
                      <td className="p-3 text-right">{e.updated ?? "—"}{e.total != null ? ` / ${e.total}` : ""}</td>
                      <td className="p-3 max-w-sm">
                        {e.error && <p className="text-xs text-destructive break-words">{e.error}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
