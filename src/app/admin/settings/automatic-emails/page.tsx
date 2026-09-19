"use client";

import { useEffect, useState } from "react";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Send, Mail, Eye, RefreshCw } from "lucide-react";
import { SAMPLE_VARS, renderTemplate } from "@/lib/automatic-emails-sample-vars";
import { authedFetch } from "@/lib/admin-fetch";

type TriggerKey = "booking_confirmed" | "order_confirmation" | "order_shipped" | "order_delivered" | "order_cancelled" | "order_refunded" | "newsletter_welcome" | "abandoned_cart";

type AutomaticEmail = {
  trigger_key: TriggerKey;
  enabled: boolean;
  subject: string;
  html_content: string;
  sender_name: string | null;
  sender_email: string | null;
  delay_hours: number | null;
};

const LABELS: Record<TriggerKey, { title: string; description: string; vars: string[] }> = {
  booking_confirmed: {
    title: "Reserva confirmada",
    description: "Enviado quando uma reserva muda de status para \"Confirmada\" em Reservas — ou seja, assim que o pagamento é confirmado.",
    vars: ["customer_name", "confirmation_number", "car_name", "pickup_date", "pickup_time", "return_date", "return_time", "days", "protection_plan", "extras_list", "estimated_total"],
  },
  order_confirmation: {
    title: "Confirmação de pedido",
    description: "Enviado assim que um pagamento é concluído na loja (checkout Stripe).",
    vars: ["customer_name", "order_number", "order_total", "shipping_address", "items_list"],
  },
  order_shipped: {
    title: "Pedido enviado",
    description: "Enviado quando o pedido muda para \"Enviado\" (automático via rastreio, ou manual em Pedidos).",
    vars: ["customer_name", "order_number", "carrier", "tracking_number", "tracking_url"],
  },
  order_delivered: {
    title: "Pedido entregue",
    description: "Enviado quando o rastreio confirma a entrega.",
    vars: ["customer_name", "order_number"],
  },
  order_cancelled: {
    title: "Pedido cancelado",
    description: "Modelo pronto — ainda não disparado automaticamente (nenhum fluxo de cancelamento único no admin hoje). Pode ser disparado manualmente via API.",
    vars: ["customer_name", "order_number"],
  },
  order_refunded: {
    title: "Reembolso realizado",
    description: "Enviado quando um reembolso (total ou parcial) é CONCLUÍDO no Stripe (status \"succeeded\") — pelo botão em Pedidos ou direto no Dashboard do Stripe. Requer o evento \"refund.updated\" habilitado no endpoint de webhook do Stripe.",
    vars: ["customer_name", "order_number", "refund_amount"],
  },
  newsletter_welcome: {
    title: "Boas-vindas à newsletter",
    description: "Enviado quando alguém se inscreve na newsletter do site.",
    vars: ["customer_name"],
  },
  abandoned_cart: {
    title: "Carrinho abandonado",
    description: "Enviado quando um checkout é iniciado (com e-mail preenchido) mas não é concluído dentro do prazo abaixo.",
    vars: ["customer_name", "items_list", "store_url"],
  },
};

const ORDER: TriggerKey[] = ["booking_confirmed", "order_confirmation", "order_shipped", "order_delivered", "order_cancelled", "order_refunded", "newsletter_welcome", "abandoned_cart"];

function EmailRow({ email, onSaved }: { email: AutomaticEmail; onSaved: (e: AutomaticEmail) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState(email);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const info = LABELS[email.trigger_key];

  async function handleSave() {
    setSaving(true);
    try {
      const res = await authedFetch(`/api/automatic-emails/${email.trigger_key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: form.enabled,
          subject: form.subject,
          html_content: form.html_content,
          sender_name: form.sender_name,
          sender_email: form.sender_email,
          delay_hours: form.delay_hours,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.email);
      toast({ title: "Salvo", description: `${info.title} atualizado.` });
    } catch (e) {
      toast({ title: "Erro ao salvar", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testEmail.trim()) return;
    setTesting(true);
    try {
      const res = await authedFetch(`/api/automatic-emails/${email.trigger_key}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Teste enviado!", description: `Verifique a caixa de entrada de ${testEmail}.` });
    } catch (e) {
      toast({ title: "Erro ao enviar teste", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AccordionItem value={email.trigger_key}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3 flex-1">
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Switch
              checked={form.enabled}
              onCheckedChange={(checked) => {
                setForm((f) => ({ ...f, enabled: checked }));
                authedFetch(`/api/automatic-emails/${email.trigger_key}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ enabled: checked }),
                }).then(() => onSaved({ ...form, enabled: checked }));
              }}
            />
          </span>
          <div className="text-left">
            <div className="font-medium">{info.title}</div>
            <div className="text-xs text-muted-foreground font-normal">{info.description}</div>
          </div>
          {!form.enabled && <Badge variant="secondary" className="ml-auto mr-2 text-[10px]">Desativado</Badge>}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Assunto</Label>
            <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
          </div>

          {email.trigger_key === "abandoned_cart" && (
            <div className="w-48">
              <Label>Disparar após (horas)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={form.delay_hours ?? 4}
                onChange={(e) => setForm((f) => ({ ...f, delay_hours: Number(e.target.value) }))}
              />
            </div>
          )}

          <div>
            <Label>Conteúdo (HTML)</Label>
            <Textarea rows={10} className="font-mono text-xs" value={form.html_content} onChange={(e) => setForm((f) => ({ ...f, html_content: e.target.value }))} />
            <p className="text-xs text-muted-foreground mt-1">
              Variáveis disponíveis: {info.vars.map((v) => `{${v}}`).join(", ")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome do remetente (opcional)</Label>
              <Input value={form.sender_name ?? ""} onChange={(e) => setForm((f) => ({ ...f, sender_name: e.target.value }))} placeholder="Vertex Rental Cars" />
            </div>
            <div>
              <Label>E-mail do remetente (opcional)</Label>
              <Input value={form.sender_email ?? ""} onChange={(e) => setForm((f) => ({ ...f, sender_email: e.target.value }))} placeholder="usa o padrão do Brevo se vazio" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Input
                placeholder="seu@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-56"
              />
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                {testing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Enviar teste
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Ver e-mail
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </AccordionContent>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização — {info.title}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">
            <strong>Assunto:</strong> {renderTemplate(form.subject, SAMPLE_VARS)}
          </p>
          <div className="border rounded-md overflow-hidden bg-white">
            <iframe
              title="Pré-visualização do e-mail"
              sandbox=""
              srcDoc={renderTemplate(form.html_content, SAMPLE_VARS)}
              className="w-full h-[500px]"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Renderizado com dados de exemplo (mesmos do &quot;Enviar teste&quot;) — não é uma mensagem real.
          </p>
        </DialogContent>
      </Dialog>
    </AccordionItem>
  );
}

type EmailLogEntry = {
  id: string;
  trigger_key: TriggerKey;
  recipient_email: string;
  recipient_name: string | null;
  subject: string | null;
  status: "sent" | "failed" | "disabled" | "error";
  error_message: string | null;
  created_at: string;
};

const LOG_STATUS_LABEL: Record<EmailLogEntry["status"], string> = {
  sent: "Enviado",
  failed: "Falhou",
  disabled: "Modelo desativado",
  error: "Erro",
};

function LogStatusBadge({ status }: { status: EmailLogEntry["status"] }) {
  const variant = status === "sent" ? "default" : status === "disabled" ? "secondary" : "destructive";
  return <Badge variant={variant}>{LOG_STATUS_LABEL[status]}</Badge>;
}

function EmailLogSection() {
  const [log, setLog] = useState<EmailLogEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [triggerFilter, setTriggerFilter] = useState<TriggerKey | "all">("all");

  async function fetchLog(filter: TriggerKey | "all") {
    setLoading(true);
    try {
      const qs = filter === "all" ? "" : `?trigger_key=${filter}`;
      const res = await authedFetch(`/api/automatic-emails/log${qs}`);
      const data = await res.json();
      setLog(data.log ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLog(triggerFilter);
  }, [triggerFilter]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Histórico de envios</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Últimos e-mails automáticos disparados (não inclui envios de teste).</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={triggerFilter} onValueChange={(v) => setTriggerFilter(v as TriggerKey | "all")}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {ORDER.map((key) => (<SelectItem key={key} value={key}>{LABELS[key].title}</SelectItem>))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => fetchLog(triggerFilter)} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!log ? (
          <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
          </div>
        ) : log.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum e-mail enviado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enviado em</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {log.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(entry.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-sm">{LABELS[entry.trigger_key]?.title ?? entry.trigger_key}</TableCell>
                    <TableCell className="text-sm">
                      {entry.recipient_name ? `${entry.recipient_name} — ` : ""}
                      {entry.recipient_email}
                    </TableCell>
                    <TableCell className="text-sm max-w-[280px] truncate" title={entry.subject ?? undefined}>
                      {entry.subject ?? "—"}
                    </TableCell>
                    <TableCell>
                      <LogStatusBadge status={entry.status} />
                      {entry.error_message && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[220px] truncate" title={entry.error_message}>
                          {entry.error_message}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AutomaticEmailsPage() {
  const [emails, setEmails] = useState<AutomaticEmail[] | null>(null);

  useEffect(() => {
    authedFetch("/api/automatic-emails")
      .then((r) => r.json())
      .then((d) => setEmails(d.emails ?? []));
  }, []);

  function updateLocal(updated: AutomaticEmail) {
    setEmails((prev) => (prev ? prev.map((e) => (e.trigger_key === updated.trigger_key ? updated : e)) : prev));
  }

  const sorted = emails ? [...emails].sort((a, b) => ORDER.indexOf(a.trigger_key) - ORDER.indexOf(b.trigger_key)) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm">E-mails automáticos enviados pela loja em cada etapa da venda.</p>
      </div>

      <SettingsTabs />

      <Card>
        <CardContent className="pt-6">
          {!sorted ? (
            <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {sorted.map((email) => (
                <EmailRow key={email.trigger_key} email={email} onSaved={updateLocal} />
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Mail className="h-3.5 w-3.5" /> Enviados via Brevo — mesma conta já conectada em Email Marketing.
      </p>

      <EmailLogSection />
    </div>
  );
}
