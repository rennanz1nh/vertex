"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Users } from "lucide-react";
import { GoogleCloudAutomationTabs } from "@/components/google-cloud/GoogleCloudAutomationTabs";
import { GoogleCloudLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";

type IamBinding = { role: string; members: string[] };

function shortRole(role: string) {
  return role.replace(/^roles\//, "");
}

function memberBadgeVariant(member: string): "default" | "outline" {
  return member.startsWith("serviceAccount:") ? "outline" : "default";
}

function memberLabel(member: string) {
  return member.replace(/^(user|serviceAccount|group|domain):/, "");
}

export default function GoogleCloudIamPage() {
  const [bindings, setBindings] = useState<IamBinding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authedFetch("/api/google-cloud/iam")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) {
          setError(d.error || "Erro ao carregar acessos");
          return;
        }
        setBindings(d.bindings);
      })
      .catch(() => setError("Falha na conexão ao carregar acessos"))
      .finally(() => setLoading(false));
  }, []);

  const totalPrincipals = new Set((bindings ?? []).flatMap((b) => b.members)).size;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <GoogleCloudLogo className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acessos (IAM)</h1>
          <p className="text-muted-foreground text-sm">
            Quem — pessoas ou contas de serviço — tem acesso a este projeto GCP, e com qual permissão.
          </p>
        </div>
      </div>

      <GoogleCloudAutomationTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            {error.includes("403") && (
              <>
                {" "}A conta de serviço provavelmente precisa do papel <span className="font-mono">roles/viewer</span> (ou
                equivalente) no projeto para ler a política de IAM — conceda isso em IAM &amp; Admin → IAM no Google Cloud Console.
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando...</span>
        </div>
      ) : bindings ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Papéis no projeto</CardTitle>
            <CardDescription>{totalPrincipals} identidade(s) distinta(s) com algum papel neste projeto.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {bindings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhum papel encontrado (ou sem permissão para ler a política).</p>
            ) : (
              bindings.map((b) => (
                <div key={b.role} className="border rounded-lg p-3 space-y-2">
                  <p className="font-mono text-sm font-medium">{shortRole(b.role)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {b.members.map((m) => (
                      <Badge key={m} variant={memberBadgeVariant(m)} className="text-xs font-normal">
                        {memberLabel(m)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
