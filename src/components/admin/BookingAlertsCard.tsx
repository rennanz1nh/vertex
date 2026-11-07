"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CalendarCheck, Loader2, Save, Send, CheckCircle2 } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type Form = { emails: string; phones: string; smsEnabled: boolean; smsSender: string };
type Effective = { emails: string[]; phones: string[]; smsEnabled: boolean; smsSender: string };
type Result = { channel: string; to: string; ok: boolean; error?: string };

/** Settings → who is told (email + SMS) about every booking paid on the site. */
export function BookingAlertsCard() {
  const [form, setForm] = useState<Form | null>(null);
  const [effective, setEffective] = useState<Effective | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadEffective() {
    const r = await authedFetch("/api/settings/notifications/booking-test");
    if (r.ok) setEffective(await r.json());
  }

  useEffect(() => {
    authedFetch("/api/settings/notifications")
      .then((r) => r.json())
      .then((d) => {
        const s = d.settings ?? {};
        setForm({
          emails: s.booking_alert_emails ?? "",
          phones: s.booking_alert_phones ?? "",
          smsEnabled: !!s.booking_alert_sms_enabled,
          smsSender: s.booking_alert_sms_sender ?? "",
        });
      })
      .catch(() => setError("Não foi possível carregar."));
    authedFetch("/api/settings/notifications/booking-test")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setEffective(d); })
      .catch(() => {});
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const r = await authedFetch("/api/settings/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_alert_emails: form.emails,
          booking_alert_phones: form.phones,
          booking_alert_sms_enabled: form.smsEnabled,
          booking_alert_sms_sender: form.smsSender,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Erro ao salvar");
      setForm((f) => (f ? { ...f, emails: d.settings.booking_alert_emails ?? "", phones: d.settings.booking_alert_phones ?? "" } : f));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadEffective();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    setResults(null);
    try {
      const r = await authedFetch("/api/settings/notifications/booking-test", { method: "POST" });
      const d = await r.json();
      setResults(d.results ?? []);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          Avisos de nova reserva
        </CardTitle>
        <CardDescription>
          A cada reserva paga no site, enviamos um e-mail (e SMS, se ligado) com carro, datas, cliente e valores, mais o lembrete de bloquear na Turo. O push no celular segue a notificação &quot;Nova reserva no site&quot; logo abaixo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!form ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="alert_emails">E-mails que recebem</Label>
              <Input id="alert_emails" value={form.emails} onChange={(e) => setForm({ ...form, emails: e.target.value })} placeholder="reservas@vertexrentalcar.com, socio@gmail.com" />
              <p className="text-xs text-muted-foreground">
                Separe por vírgula. Em branco, usa o e-mail da empresa (Configurações → Google) ou o do admin.
                {effective && <> Hoje vai para: <strong>{effective.emails.join(", ") || "ninguém"}</strong>.</>}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="alert_phones">Celulares para SMS</Label>
              <Input id="alert_phones" value={form.phones} onChange={(e) => setForm({ ...form, phones: e.target.value })} placeholder="+1 407 922 4078, +1 407 555 0100" />
              <p className="text-xs text-muted-foreground">
                Com código do país. Em branco, usa o telefone da empresa ou o WhatsApp do site.
                {effective && <> Hoje: <strong>{effective.phones.map((p) => `+${p}`).join(", ") || "nenhum"}</strong>.</>}
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 p-3 border rounded-lg bg-muted/30">
              <div>
                <Label className="font-semibold">Enviar SMS</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pelo Brevo. Precisa de créditos de SMS na conta Brevo e, para números dos EUA, de um número toll-free aprovado (Brevo → SMS → Senders; a aprovação leva semanas). Enquanto isso, deixe desligado.
                </p>
              </div>
              <Switch checked={form.smsEnabled} onCheckedChange={(v) => setForm({ ...form, smsEnabled: v })} className="data-[state=checked]:bg-black" />
            </div>

            {form.smsEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="sms_sender">Remetente do SMS</Label>
                <Input id="sms_sender" value={form.smsSender} onChange={(e) => setForm({ ...form, smsSender: e.target.value })} placeholder="Número toll-free aprovado, ex: 18005551234" />
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            {results && (
              <ul className="text-xs space-y-1">
                {results.length === 0 && <li className="text-muted-foreground">Nenhum destinatário configurado.</li>}
                {results.map((r, i) => (
                  <li key={i} className={r.ok ? "text-green-700" : "text-red-700"}>
                    {r.ok ? "✓" : "✗"} {r.channel === "email" ? "E-mail" : r.channel === "sms" ? "SMS" : "Push"} para {r.to}
                    {r.error ? `: ${r.error.slice(0, 200)}` : ""}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={test} disabled={testing}>
                {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Enviar teste
              </Button>
              <Button className="bg-black hover:bg-black/80 text-white" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                {saved ? "Salvo!" : "Salvar"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
