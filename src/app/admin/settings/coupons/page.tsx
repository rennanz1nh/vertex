"use client";

import { useEffect, useState } from "react";
import { SettingsTabs } from "@/components/admin/SettingsTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Ticket } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  active: boolean;
  stripe_promotion_code_id: string | null;
};

function formatDiscount(c: Coupon) {
  return c.discount_type === "percent" ? `${c.discount_value}%` : `$${c.discount_value.toFixed(2)}`;
}

export default function CouponsPage() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discount_type: "percent" as "percent" | "fixed", discount_value: "" });

  async function fetchCoupons() {
    const res = await authedFetch("/api/coupons");
    const data = await res.json();
    setCoupons(data.coupons ?? []);
  }

  useEffect(() => {
    authedFetch("/api/coupons")
      .then((r) => r.json())
      .then((d) => setCoupons(d.coupons ?? []));
  }, []);

  async function handleCreate() {
    if (!form.code.trim() || !form.discount_value) return;
    setSaving(true);
    try {
      const res = await authedFetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim(),
          description: form.description.trim() || null,
          discount_type: form.discount_type,
          discount_value: Number(form.discount_value),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: "Cupom criado!", description: `${data.coupon.code} já pode ser usado no checkout.` });
      setForm({ code: "", description: "", discount_type: "percent", discount_value: "" });
      setCreating(false);
      fetchCoupons();
    } catch (e) {
      toast({ title: "Erro ao criar cupom", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon, active: boolean) {
    setCoupons((prev) => prev?.map((c) => (c.id === coupon.id ? { ...c, active } : c)) ?? prev);
    try {
      const res = await authedFetch(`/api/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      setCoupons((prev) => prev?.map((c) => (c.id === coupon.id ? { ...c, active: !active } : c)) ?? prev);
      toast({ title: "Erro ao atualizar cupom", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground text-sm">Cupons de desconto usados no checkout da loja (via Stripe Promotion Codes).</p>
        </div>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo cupom
          </Button>
        )}
      </div>

      <SettingsTabs />

      {creating && (
        <Card>
          <CardContent className="pt-6 grid gap-4 sm:grid-cols-4 items-end">
            <div>
              <Label>Código</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="WELCOME10"
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.discount_type} onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v as "percent" | "fixed" }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Porcentagem (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{form.discount_type === "percent" ? "Desconto (%)" : "Desconto ($)"}</Label>
              <Input
                type="number"
                min={0}
                max={form.discount_type === "percent" ? 100 : undefined}
                value={form.discount_value}
                onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
                placeholder={form.discount_type === "percent" ? "10" : "5.00"}
              />
            </div>
            <div className="sm:col-span-4">
              <Label>Descrição (opcional, uso interno)</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex: usado no e-mail de boas-vindas" />
            </div>
            <div className="sm:col-span-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Criar no Stripe
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {!coupons ? (
            <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : coupons.length === 0 ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-10">
              <Ticket className="h-6 w-6" />
              <p className="text-sm">Nenhum cupom cadastrado ainda.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status no Stripe</TableHead>
                  <TableHead className="w-[100px]">Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium font-mono">{c.code}</TableCell>
                    <TableCell>{formatDiscount(c)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.description || "—"}</TableCell>
                    <TableCell>
                      {c.stripe_promotion_code_id ? (
                        <Badge variant="secondary">Sincronizado</Badge>
                      ) : (
                        <Badge variant="destructive">Falhou ao sincronizar</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch checked={c.active} onCheckedChange={(v) => toggleActive(c, v)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Cupons criados aqui viram <strong>Promotion Codes</strong> reais no Stripe — clientes digitam o código no checkout e o desconto aplica automaticamente.
        Após criado, o código e o desconto não podem ser editados (limitação do próprio Stripe); desative e crie um novo se precisar mudar algo.
      </p>
    </div>
  );
}
