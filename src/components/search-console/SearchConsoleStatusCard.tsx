"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2, Copy, Check, RefreshCw, ChevronDown } from "lucide-react";
import { GoogleSearchConsoleLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type Status = {
  connected: boolean;
  serviceAccountEmail: string | null;
  siteUrl: string;
  permissionLevel?: string;
  error: string | null;
};

/** Shown at the top of both Search Console pages — connection status, with setup
 *  instructions (service account email to add as a Search Console user, site URL to
 *  save) when not yet connected. Collapses to a one-line confirmation once connected. */
export function SearchConsoleStatusCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [siteUrlInput, setSiteUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/search-console/status");
      const data = await res.json();
      setStatus(data);
      setSiteUrlInput(data.siteUrl || "");
    } catch {
      setStatus({ connected: false, serviceAccountEmail: null, siteUrl: "", error: "Falha na conexão" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function handleSaveSiteUrl() {
    setSaving(true);
    try {
      await authedFetch("/api/search-console/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: siteUrlInput }),
      });
      await fetchStatus();
    } finally {
      setSaving(false);
    }
  }

  function copyEmail() {
    if (!status?.serviceAccountEmail) return;
    navigator.clipboard.writeText(status.serviceAccountEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando conexão com o Search Console...
      </div>
    );
  }

  if (status?.connected && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 hover:bg-green-100 transition-colors"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">
          Conectado ao Search Console ({status.siteUrl}) — nível de acesso: {status.permissionLevel}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>
    );
  }

  return (
    <Card className={status?.connected ? "border-green-200" : "border-amber-200"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GoogleSearchConsoleLogo className="h-5 w-5" />
          Conexão com o Google Search Console
        </CardTitle>
        <CardDescription>
          Usa a mesma conta de serviço do Google Shopping — não precisa de uma nova credencial, só
          adicionar o e-mail dela como usuária da propriedade no Search Console.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status?.error && (
          <Alert variant={status.connected ? "default" : "destructive"}>
            {status.connected ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{status.error}</AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          0. Pré-requisito: o domínio precisa já estar verificado no Search Console — isso é feito
          separadamente, com a tag de verificação em{" "}
          <a href="/admin/settings/google" className="underline">
            Configurações &gt; Google &gt; Google Search Console
          </a>
          . Só depois de verificado é possível adicionar a conta de serviço como usuária dele (passo 1).
        </p>

        {status?.serviceAccountEmail && (
          <div className="space-y-1.5">
            <Label>1. Adicione este e-mail como usuário no Search Console</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={status.serviceAccountEmail} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={copyEmail} title="Copiar" type="button">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Em Search Console → Configurações → Usuários e permissões → Adicionar usuário → cole o
              e-mail acima com permissão &quot;Completa&quot;.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="sc-site-url">2. URL da propriedade (exatamente como está no Search Console)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="sc-site-url"
              value={siteUrlInput}
              onChange={(e) => setSiteUrlInput(e.target.value)}
              placeholder="https://vertexrentalcars.com/ ou sc-domain:vertexrentalcars.com"
            />
            <Button variant="outline" onClick={handleSaveSiteUrl} disabled={saving} type="button">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={fetchStatus} type="button" className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Testar conexão
        </Button>
      </CardContent>
    </Card>
  );
}
