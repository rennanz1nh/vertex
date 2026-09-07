"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Mail, MailOpen, MousePointerClick, Users, ListChecks } from "lucide-react";
import { EmailMarketingTabs } from "@/components/email-marketing/EmailMarketingTabs";
import { EmailMarketingHeader } from "@/components/email-marketing/EmailMarketingHeader";
import { authedFetch } from "@/lib/admin-fetch";

type Stats = {
  totalContacts: number;
  totalLists: number;
  stats: {
    requests?: number;
    delivered?: number;
    opens?: number;
    uniqueOpens?: number;
    clicks?: number;
    uniqueClicks?: number;
    softBounces?: number;
    hardBounces?: number;
    unsubscribed?: number;
  } | null;
};

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-black flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function EmailMarketingOverview() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    authedFetch("/api/email-marketing/stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
          return;
        }
        setData(d);
      })
      .catch(() => setError("Falha ao carregar estatísticas"))
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

  return (
    <div className="space-y-6">
      <EmailMarketingHeader />

      <EmailMarketingTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando estatísticas...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Contatos" value={data?.totalContacts ?? 0} />
            <StatCard icon={ListChecks} label="Listas" value={data?.totalLists ?? 0} />
            <StatCard icon={Mail} label="Emails Enviados (30d)" value={s?.delivered ?? 0} />
            <StatCard icon={MailOpen} label="Aberturas Únicas (30d)" value={s?.uniqueOpens ?? 0} />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={MousePointerClick} label="Cliques Únicos (30d)" value={s?.uniqueClicks ?? 0} />
            <StatCard icon={AlertCircle} label="Bounces (30d)" value={(s?.softBounces ?? 0) + (s?.hardBounces ?? 0)} />
            <StatCard icon={Users} label="Descadastros (30d)" value={s?.unsubscribed ?? 0} />
            <StatCard icon={Mail} label="Solicitações (30d)" value={s?.requests ?? 0} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Próximos passos</CardTitle>
              <CardDescription>Como usar essa área</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Vá em <strong>Contatos & Listas</strong> e sincronize seus clientes com o Brevo.</p>
              <p>2. Crie uma lista e organize seus contatos por segmento.</p>
              <p>3. Vá em <strong>Campanhas</strong> para criar e disparar uma campanha de e-mail.</p>
              <p>4. Use <strong>Templates</strong> para reaproveitar layouts entre campanhas.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
