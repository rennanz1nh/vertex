"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Wifi, WifiOff } from "lucide-react";
import { EmailMarketingTabs } from "@/components/email-marketing/EmailMarketingTabs";
import { EmailMarketingHeader } from "@/components/email-marketing/EmailMarketingHeader";
import { authedFetch } from "@/lib/admin-fetch";

type Status = {
  connected: boolean;
  reason?: string;
  error?: string;
  companyName?: string;
  email?: string;
  plan?: { type: string; credits: number }[];
  senders?: { email: string; active: boolean }[];
  configuredSender?: string | null;
};

export default function EmailMarketingSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authedFetch("/api/email-marketing/status")
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <EmailMarketingHeader />

      <EmailMarketingTabs />

      <Card>
        <CardHeader>
          <CardTitle>Conexão com o Brevo</CardTitle>
          <CardDescription>Status da API key configurada no servidor (BREVO_API_KEY)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando conexão...
            </div>
          ) : status?.connected ? (
            <>
              <Badge className="bg-green-100 text-green-700 border-green-300 gap-1.5 w-fit">
                <Wifi className="h-3 w-3" /> Conectado
              </Badge>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Conta</p>
                  <p className="font-medium">{status.companyName || status.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remetente configurado</p>
                  <p className="font-medium">{status.configuredSender || "Não configurado"}</p>
                </div>
              </div>
              {status.plan && status.plan.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Plano</p>
                  <div className="flex gap-2 flex-wrap">
                    {status.plan.map((p, i) => (
                      <Badge key={i} variant="outline">{p.type} — {p.credits} créditos</Badge>
                    ))}
                  </div>
                </div>
              )}
              {status.senders && status.senders.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Remetentes verificados</p>
                  <div className="flex gap-2 flex-wrap">
                    {status.senders.map((s, i) => (
                      <Badge key={i} variant={s.active ? "default" : "outline"}>{s.email}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <Badge variant="outline" className="gap-1.5 text-muted-foreground w-fit">
                <WifiOff className="h-3 w-3" /> Não conectado
              </Badge>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {status?.reason === "missing_api_key"
                    ? "Variável de ambiente BREVO_API_KEY não configurada."
                    : status?.error || "Não foi possível conectar à API do Brevo."}
                </AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como configurar</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Crie uma conta gratuita em <strong>brevo.com</strong>.</p>
          <p>2. Gere uma API key em Settings → SMTP & API → API Keys.</p>
          <p>3. Verifique um e-mail remetente em Settings → Senders, Domains & Dedicated IPs.</p>
          <p>4. Configure <code className="text-xs bg-muted px-1 py-0.5 rounded">BREVO_API_KEY</code> e <code className="text-xs bg-muted px-1 py-0.5 rounded">BREVO_SENDER_EMAIL</code> nas variáveis de ambiente (local e Vercel).</p>
        </CardContent>
      </Card>
    </div>
  );
}
