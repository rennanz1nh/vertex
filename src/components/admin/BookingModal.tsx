"use client";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Trash2, Check, Image as ImageIcon } from "lucide-react";
import { US_STATES } from "@/lib/us-states";
import { BOOKING_STATUS_LABEL, type BookingStatus } from "@/lib/booking-status";
import {
  PROTECTION_PLANS,
  EXTRAS,
  ageFromDateOfBirth,
  youngDriverFeePerDay,
  MINIMUM_DRIVER_AGE,
  tripDays as calcTripDays,
  tripPriceBreakdown,
  type ProtectionPlanId,
  type ExtraId,
  type TripDraft,
} from "@/lib/tripDraft";

type CarOption = { id: string; name: string | null; make: string | null; model: string | null; year: number | null; daily_rate: string | null; min_driver_age: number };

const STATUS_OPTIONS: { value: BookingStatus; label: string }[] = (
  Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]
).map((value) => ({ value, label: BOOKING_STATUS_LABEL[value] }));

type Props = {
  booking: Record<string, unknown> | null;
  cars: CarOption[];
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

const EMPTY_FORM = {
  car_id: "",
  status: "pending_payment",
  pickup_date: "", pickup_time: "10:00", return_date: "", return_time: "10:00",
  daily_rate: "",
  protection_plan: "basic" as ProtectionPlanId,
  extras: [] as ExtraId[],
  driver_full_name: "", driver_date_of_birth: "", driver_license_number: "", driver_license_expiration: "", driver_license_state: "",
  customer_name: "", customer_email: "",
  notes: "",
};

export default function BookingModal({ booking, cars, open, onClose, onChanged }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [licensePhotoUrls, setLicensePhotoUrls] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const [loadingLicensePhotos, setLoadingLicensePhotos] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [loadingSignature, setLoadingSignature] = useState(false);

  useEffect(() => {
    setForm(booking ? { ...EMPTY_FORM, ...booking } : {});
    setConfirmDelete(false);
  }, [booking]);

  useEffect(() => {
    const frontPath = booking?.driver_license_front_path as string | null | undefined;
    const backPath = booking?.driver_license_back_path as string | null | undefined;
    setLicensePhotoUrls({ front: null, back: null });
    if (!frontPath && !backPath) return;
    setLoadingLicensePhotos(true);
    Promise.all([
      frontPath ? supabase.storage.from("vertex-license-photos").createSignedUrl(frontPath, 300) : Promise.resolve(null),
      backPath ? supabase.storage.from("vertex-license-photos").createSignedUrl(backPath, 300) : Promise.resolve(null),
    ])
      .then(([frontRes, backRes]) => {
        setLicensePhotoUrls({
          front: frontRes?.data?.signedUrl || null,
          back: backRes?.data?.signedUrl || null,
        });
      })
      .finally(() => setLoadingLicensePhotos(false));
  }, [booking?.driver_license_front_path, booking?.driver_license_back_path]);

  useEffect(() => {
    const path = booking?.rental_agreement_signature_path as string | null | undefined;
    setSignatureUrl(null);
    if (!path) return;
    setLoadingSignature(true);
    supabase.storage
      .from("vertex-rental-agreements")
      .createSignedUrl(path, 300)
      .then((res) => setSignatureUrl(res.data?.signedUrl || null))
      .finally(() => setLoadingSignature(false));
  }, [booking?.rental_agreement_signature_path]);

  const isNew = !booking?.id;
  const id = (booking?.id as string) || "";
  const set = (field: string, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));
  const v = (field: string) => (form[field] ?? "") as string;

  const selectedCar = cars.find((c) => c.id === v("car_id"));

  function setCar(carId: string) {
    const car = cars.find((c) => c.id === carId);
    setForm((prev) => ({
      ...prev,
      car_id: carId,
      daily_rate: car?.daily_rate ?? prev.daily_rate,
    }));
  }

  const extras = Array.isArray(form.extras) ? (form.extras as ExtraId[]) : [];
  function toggleExtra(extraId: ExtraId) {
    setForm((prev) => {
      const cur = Array.isArray(prev.extras) ? (prev.extras as ExtraId[]) : [];
      const next = cur.includes(extraId) ? cur.filter((e) => e !== extraId) : [...cur, extraId];
      return { ...prev, extras: next };
    });
  }

  const days = v("pickup_date") && v("return_date") ? calcTripDays({ pickupDate: v("pickup_date"), returnDate: v("return_date") }) : 0;

  const breakdown = useMemo(() => {
    const draft: TripDraft = {
      carId: v("car_id"),
      carName: selectedCar?.name || "",
      carImage: null,
      dailyRate: parseFloat(v("daily_rate")) || 0,
      minDriverAge: selectedCar?.min_driver_age || MINIMUM_DRIVER_AGE,
      pickupDate: v("pickup_date"),
      pickupTime: v("pickup_time"),
      returnDate: v("return_date"),
      returnTime: v("return_time"),
      protectionPlan: (v("protection_plan") || "basic") as ProtectionPlanId,
      extras,
      driver: v("driver_date_of_birth")
        ? {
            fullName: v("driver_full_name"), email: "", phone: "",
            dateOfBirth: v("driver_date_of_birth"), licenseNumber: v("driver_license_number"),
            licenseExpiration: v("driver_license_expiration"), licenseState: v("driver_license_state"),
          }
        : null,
    };
    if (!draft.pickupDate || !draft.returnDate) return null;
    return tripPriceBreakdown(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, selectedCar]);

  const age = v("driver_date_of_birth") ? ageFromDateOfBirth(v("driver_date_of_birth")) : null;
  const youngFee = age != null ? youngDriverFeePerDay(age) : 0;

  async function handleSave() {
    if (!v("car_id")) { toast({ title: "Selecione um carro", variant: "destructive" }); return; }
    if (!v("pickup_date") || !v("return_date")) { toast({ title: "Preencha as datas da viagem", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { id: _omit, ...rest } = form;
      const payload = {
        ...rest,
        extras,
        daily_rate: parseFloat(v("daily_rate")) || 0,
        trip_subtotal: breakdown?.tripSubtotal ?? 0,
        protection_total: breakdown?.protectionTotal ?? 0,
        extras_total: breakdown?.extrasTotal ?? 0,
        young_driver_fee_total: breakdown?.youngDriverFeeTotal ?? 0,
        estimated_total: breakdown?.total ?? 0,
      };
      const { error } = isNew
        ? await supabase.from("bookings").insert(payload as unknown as TablesInsert<"bookings">)
        : await supabase.from("bookings").update(payload as unknown as TablesUpdate<"bookings">).eq("id", id);
      if (error) throw error;
      toast({ title: "Salvo!", description: isNew ? "Reserva criada com sucesso." : "Reserva atualizada com sucesso." });
      onChanged();
      onClose();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      const { error } = await supabase.from("bookings").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Excluída", description: "Reserva removida." });
      onChanged();
      onClose();
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao excluir", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  if (!booking) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova Reserva" : `Reserva — ${selectedCar ? [selectedCar.year, selectedCar.make, selectedCar.model].filter(Boolean).join(" ") : ""}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Trip */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Viagem</h3>
            <div>
              <Label className="text-xs">Carro</Label>
              <Select value={v("car_id") || undefined} onValueChange={setCar}>
                <SelectTrigger><SelectValue placeholder="Selecione o carro" /></SelectTrigger>
                <SelectContent>
                  {cars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name || [c.year, c.make, c.model].filter(Boolean).join(" ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Retirada</Label>
                <Input type="date" lang="en-US" value={v("pickup_date")} onChange={(e) => set("pickup_date", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Hora</Label>
                <Input type="time" lang="en-US" value={v("pickup_time")} onChange={(e) => set("pickup_time", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Devolução</Label>
                <Input type="date" lang="en-US" value={v("return_date")} onChange={(e) => set("return_date", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Hora</Label>
                <Input type="time" lang="en-US" value={v("return_time")} onChange={(e) => set("return_time", e.target.value)} />
              </div>
            </div>
            <div className="w-32">
              <Label className="text-xs">Diária</Label>
              <Input type="number" step="0.01" value={v("daily_rate")} onChange={(e) => set("daily_rate", e.target.value)} />
            </div>
            {days > 0 && <p className="text-xs text-muted-foreground">{days} dia{days > 1 ? "s" : ""}</p>}
          </div>

          {/* Protection & extras */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Proteção e extras</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              {PROTECTION_PLANS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => set("protection_plan", p.id)}
                  className={`text-left border rounded-sm p-2.5 text-xs transition-colors ${v("protection_plan") === p.id || (!v("protection_plan") && p.id === "basic") ? "border-black ring-1 ring-black" : "border-gray-200 hover:border-gray-400"}`}
                >
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-muted-foreground mt-0.5">{p.pricePerDay === 0 ? "Incluído" : `$${p.pricePerDay}/dia`}</p>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              {EXTRAS.map((extra) => (
                <label key={extra.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={extras.includes(extra.id)} onCheckedChange={() => toggleExtra(extra.id)} />
                  <span className="flex-1">{extra.name}</span>
                  <span className="text-xs text-muted-foreground">${extra.price}{extra.perDay ? "/dia" : ""}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Driver */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Motorista</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs">Nome completo</Label>
                <Input value={v("driver_full_name")} onChange={(e) => set("driver_full_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Data de nascimento</Label>
                <Input type="date" lang="en-US" value={v("driver_date_of_birth")} onChange={(e) => set("driver_date_of_birth", e.target.value)} />
                {age != null && youngFee > 0 && <p className="text-[11px] text-amber-600 mt-1">Taxa de motorista jovem: ${youngFee}/dia</p>}
              </div>
              <div>
                <Label className="text-xs">Número da carteira</Label>
                <Input value={v("driver_license_number")} onChange={(e) => set("driver_license_number", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Validade da carteira</Label>
                <Input type="date" lang="en-US" value={v("driver_license_expiration")} onChange={(e) => set("driver_license_expiration", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Estado emissor</Label>
                <Select value={v("driver_license_state") || undefined} onValueChange={(val) => set("driver_license_state", val)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Fotos da CNH</Label>
              {loadingLicensePhotos ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando fotos...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {[
                    { label: "Frente", url: licensePhotoUrls.front },
                    { label: "Verso", url: licensePhotoUrls.back },
                  ].map((photo) => (
                    <a
                      key={photo.label}
                      href={photo.url || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`relative aspect-[3/2] rounded-sm overflow-hidden border bg-muted flex items-center justify-center ${photo.url ? "hover:opacity-90 cursor-pointer" : "cursor-default"}`}
                    >
                      {photo.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.url} alt={`CNH - ${photo.label}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                          <span className="text-[10px]">{photo.label} — não enviada</span>
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Link temporário — clique para ver em tamanho real.</p>
            </div>
          </div>

          {/* Rental agreement */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Rental Agreement</h3>
            {booking?.rental_agreement_signed_at ? (
              <div className="flex items-center gap-4">
                {loadingSignature ? (
                  <div className="w-32 aspect-[3/2] rounded-sm border bg-muted flex items-center justify-center shrink-0">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <a
                    href={signatureUrl || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-32 aspect-[3/2] rounded-sm border bg-white flex items-center justify-center shrink-0 ${signatureUrl ? "hover:opacity-90 cursor-pointer" : "cursor-default"}`}
                  >
                    {signatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={signatureUrl} alt="Assinatura do locatário" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Sem assinatura</span>
                    )}
                  </a>
                )}
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="text-foreground font-medium">Assinado</p>
                  <p>{new Date(booking.rental_agreement_signed_at as string).toLocaleString("pt-BR")}</p>
                  {typeof booking.rental_agreement_version === "string" && (
                    <p>Versão do contrato: {booking.rental_agreement_version}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Reserva criada sem assinatura do Rental Agreement (provavelmente criada manualmente pelo admin).
              </p>
            )}
          </div>

          {/* Contact */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Contato do cliente</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={v("customer_name")} onChange={(e) => set("customer_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input type="email" value={v("customer_email")} onChange={(e) => set("customer_email", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Status & notes */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={v("status") || "pending_payment"} onValueChange={(val) => set("status", val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Notas internas</Label>
              <Textarea value={v("notes")} onChange={(e) => set("notes", e.target.value)} className="min-h-[70px]" />
            </div>
          </div>

          {/* Price breakdown */}
          {breakdown && (
            <div className="rounded-lg border bg-accent/30 p-4 space-y-1.5 text-sm">
              <h3 className="text-sm font-semibold mb-1">Resumo do valor</h3>
              <div className="flex justify-between"><span className="text-muted-foreground">Diárias ({days}x)</span><span>${breakdown.tripSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{breakdown.plan.name}</span><span>${breakdown.protectionTotal.toFixed(2)}</span></div>
              {breakdown.extrasTotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Extras</span><span>${breakdown.extrasTotal.toFixed(2)}</span></div>}
              {breakdown.youngDriverFeeTotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa motorista jovem</span><span>${breakdown.youngDriverFeeTotal.toFixed(2)}</span></div>}
              <div className="flex justify-between font-semibold border-t pt-1.5 mt-1.5"><span>Total estimado</span><span>${breakdown.total.toFixed(2)}</span></div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t mt-2">
          {isNew ? <div /> : !confirmDelete ? (
            <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)} disabled={busy || saving}>
              <Trash2 className="mr-2 h-4 w-4" /> Excluir reserva
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Confirmar exclusão?</span>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Sim
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Não</Button>
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={saving}>Fechar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isNew ? "Criar Reserva" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
