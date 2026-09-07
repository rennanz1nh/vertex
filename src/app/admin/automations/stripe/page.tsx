"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { StripeLogo } from "@/components/brand-logos";
import { authedFetch } from "@/lib/admin-fetch";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Copy, Link2, DollarSign, Receipt, TrendingDown, ShieldAlert, Banknote } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

interface StripeStatus {
  configured: boolean;
  businessName?: string | null;
  email?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  taxRegistrationsCount?: number;
  webhookSecretConfigured?: boolean;
  webhooks?: { url: string; status: string; events: number }[];
  error?: string;
}

interface StripeDashboard {
  configured: boolean;
  lookbackDays?: number;
  revenue?: number;
  chargeCount?: number;
  refundRate?: number;
  disputeRate?: number;
  refundedAmount?: number;
  dailyRevenue?: { date: string; amount: number }[];
  disputes?: { id: string; amount: number; currency: string; reason: string; status: string; evidenceDueBy: string | null }[];
  payouts?: { id: string; amount: number; currency: string; status: string; arrivalDate: string }[];
  error?: string;
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-sm">{label}</span>
      <span className="flex items-center gap-1.5 text-sm">
        {detail && <span className="text-muted-foreground">{detail}</span>}
        {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
      </span>
    </div>
  );
}

function formatMoney(n: number | undefined, currency = "usd") {
  if (n === undefined) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
}

export default function StripePage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<StripeDashboard | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [generating, setGenerating] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    authedFetch("/api/stripe/status").then((r) => r.json()).then(setStatus).finally(() => setLoading(false));
    authedFetch("/api/stripe/dashboard").then((r) => r.json()).then(setDashboard).finally(() => setLoadingDashboard(false));
  }, []);

  const expectedWebhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/stripe/webhook` : "";
  const webhookRegistered = status?.webhooks?.some((w) => w.url === expectedWebhookUrl && w.status === "enabled");

  async function handleGenerateLink() {
    setLinkError(null);
    setLinkUrl(null);
    if (!name.trim() || !(Number(amount) > 0)) {
      setLinkError("Preencha o nome e um valor maior que zero.");
      return;
    }
    setGenerating(true);
    try {
      const res = await authedFetch("/api/stripe/payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, amount, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar link");
      setLinkUrl(data.url);
    } catch (e) {
      setLinkError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  function copyLink() {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    toast({ title: "Copiado!" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <StripeLogo className="h-8 w-8 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stripe</h1>
          <p className="text-muted-foreground text-sm">Status da conexão, vendas, disputas e repasses do Stripe.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conexão</CardTitle>
          <CardDescription>Chaves e configurações usadas pelo checkout da loja e por esta página.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Verificando...
            </div>
          ) : !status?.configured ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" /> STRIPE_SECRET_KEY não configurada no servidor.
            </div>
          ) : status.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {status.error}
            </div>
          ) : (
            <div>
              <StatusRow label="Chave secreta (STRIPE_SECRET_KEY)" ok={true} />
              <StatusRow label="Conta" ok={!!status.businessName || !!status.email} detail={status.businessName ?? status.email ?? undefined} />
              <StatusRow label="Recebendo pagamentos (charges_enabled)" ok={!!status.chargesEnabled} />
              <StatusRow label="Recebendo repasses (payouts_enabled)" ok={!!status.payoutsEnabled} />
              <StatusRow label="Cadastro finalizado (details_submitted)" ok={!!status.detailsSubmitted} />
              <StatusRow
                label="Registros de imposto (Stripe Tax)"
                ok={(status.taxRegistrationsCount ?? 0) > 0}
                detail={`${status.taxRegistrationsCount ?? 0} ativo(s)`}
              />
              <StatusRow label="Webhook secret (STRIPE_WEBHOOK_SECRET)" ok={!!status.webhookSecretConfigured} />
              <StatusRow
                label="Webhook cadastrado no Stripe"
                ok={!!webhookRegistered}
                detail={status.webhooks?.length ? `${status.webhooks.length} endpoint(s)` : "nenhum"}
              />
              {(status.taxRegistrationsCount ?? 0) === 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  Sem registros de imposto, o Stripe Tax calcula sempre $0 — adicione ao menos um registro em Stripe Dashboard → Tax → Registrations.
                </p>
              )}
              {!webhookRegistered && (
                <p className="text-xs text-muted-foreground mt-1">
                  Cadastre um endpoint em Stripe Dashboard → Developers → Webhooks apontando para <code>{expectedWebhookUrl}</code>, evento <code>checkout.session.completed</code>.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Apple Pay, Google Pay, Klarna e Afterpay não precisam de nenhuma mudança aqui — são ativados direto em
                Stripe Dashboard → Settings → Payment methods, e aparecem automaticamente no checkout assim que ligados lá.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {loadingDashboard ? (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando vendas...
        </div>
      ) : dashboard?.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{dashboard.error}</div>
      ) : dashboard?.configured ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Receita ({dashboard.lookbackDays}d)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatMoney(dashboard.revenue)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Transações</CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{dashboard.chargeCount ?? 0}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de reembolso</CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{((dashboard.refundRate ?? 0) * 100).toFixed(1)}%</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de disputa</CardTitle>
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{((dashboard.disputeRate ?? 0) * 100).toFixed(1)}%</div></CardContent>
            </Card>
          </div>

          {(dashboard.dailyRevenue?.length ?? 0) > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Receita por dia</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.dailyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} fontSize={11} />
                      <Tooltip formatter={(v: number) => formatMoney(v)} />
                      <Bar dataKey="amount" fill="#635BFF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Disputas em aberto</CardTitle></CardHeader>
            <CardContent>
              {!dashboard.disputes?.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma disputa em aberto</p>
              ) : (
                <div className="space-y-2">
                  {dashboard.disputes.map((d) => (
                    <div key={d.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                      <div>
                        <p className="font-medium">{formatMoney(d.amount, d.currency)} — {d.reason}</p>
                        <p className="text-xs text-muted-foreground">
                          Status: {d.status}{d.evidenceDueBy ? ` · Responder até ${new Date(d.evidenceDueBy).toLocaleDateString("pt-BR")}` : ""}
                        </p>
                      </div>
                      <a
                        href={`https://dashboard.stripe.com/disputes/${d.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline shrink-0"
                      >
                        Responder no Stripe
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Banknote className="h-4 w-4" /> Repasses recentes</CardTitle></CardHeader>
            <CardContent>
              {!dashboard.payouts?.length ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum repasse encontrado</p>
              ) : (
                <div className="space-y-2">
                  {dashboard.payouts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between border rounded-lg p-2.5 text-sm">
                      <span className="font-medium">{formatMoney(p.amount, p.currency)}</span>
                      <span className="text-xs text-muted-foreground">{new Date(p.arrivalDate).toLocaleDateString("pt-BR")}</span>
                      <Badge variant={p.status === "paid" ? "default" : "secondary"} className="text-[10px]">{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Gerar link de pagamento</CardTitle>
          <CardDescription>Cria um link avulso do Stripe (fora do carrinho da loja) para cobrar qualquer valor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label>Descrição / nome da cobrança</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Sinal do pedido personalizado" />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
          </div>
          <div className="w-40">
            <Label>Valor (USD)</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
          </div>

          <Button onClick={handleGenerateLink} disabled={generating || !status?.configured}>
            {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Gerar link de pagamento
          </Button>

          {linkError && <p className="text-sm text-destructive">{linkError}</p>}

          {linkUrl && (
            <div className="flex items-center gap-2 border rounded-lg p-3">
              <a href={linkUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline flex-1 truncate">
                {linkUrl}
              </a>
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar
              </Button>
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px]">Ativo</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
