"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { GoogleCloudAutomationTabs } from "@/components/google-cloud/GoogleCloudAutomationTabs";
import { GoogleCloudLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type ApiStatus = { key: string; name: string; connected: boolean; detail: string | null };

type Overview = {
  serviceAccountEmail: string | null;
  projectId: string | null;
  apis: ApiStatus[];
};

function consoleLink(projectId: string, path: string) {
  return `https://console.cloud.google.com/${path}?project=${projectId}`;
}

export default function GoogleCloudOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authedFetch("/api/google-cloud/overview")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Falha ao carregar visão geral"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleCloudLogo className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Google Cloud Console</h1>
          <p className="text-muted-foreground text-sm">
            Projeto GCP por trás das integrações Google (Merchant API, Search Console, GA4/BigQuery)
            e atalhos diretos para o console real.
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

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : data ? (
        <>
          {!data.projectId ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Conta de serviço não configurada no servidor (GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON ausente) —
                nada nesta seção vai funcionar até isso ser corrigido.
              </AlertDescription>
            </Alert>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Projeto</CardTitle>
                <CardDescription>Identificado a partir da conta de serviço já usada pelas integrações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm"><span className="font-medium">Project ID:</span> <span className="font-mono">{data.projectId}</span></p>
                <p className="text-sm break-all"><span className="font-medium">Conta de serviço:</span> <span className="font-mono text-xs">{data.serviceAccountEmail}</span></p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {[
                    { label: "APIs e Serviços", path: "apis/dashboard" },
                    { label: "IAM", path: "iam-admin/iam" },
                    { label: "Contas de Serviço", path: "iam-admin/serviceaccounts" },
                    { label: "Faturamento", path: "billing" },
                  ].map((l) => (
                    <a
                      key={l.path}
                      href={consoleLink(data.projectId!, l.path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm border rounded-lg px-3 py-2 hover:bg-muted transition-colors"
                    >
                      {l.label} <ExternalLink className="h-3 w-3 shrink-0 ml-auto" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>APIs em uso</CardTitle>
              <CardDescription>Integrações deste sistema que dependem deste projeto GCP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.apis.map((api) => (
                <div key={api.key} className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">{api.name}</p>
                    {api.detail && <p className="text-xs text-muted-foreground">{api.detail}</p>}
                  </div>
                  {api.connected ? (
                    <Badge className="bg-green-600 hover:bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> Não configurado</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
