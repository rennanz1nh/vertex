"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ExternalLink, Star, ShieldCheck, Loader2, Save, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type TuroGuest = {
  renter_id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  profile_url: string | null;
  image_url: string | null;
  photo_path: string | null;
  photo_verified: boolean | null;
  trips_count: number;
  cancelled_count: number;
  upcoming_count: number;
  first_trip_at: string | null;
  last_trip_at: string | null;
  total_days: number;
  total_spent: number | string;
  host_earned: number | string;
  reimbursements: number | string;
  miles_driven: number | null;
  reviews_count: number;
  avg_rating: number | string | null;
  cars: string[];
  trips: { tripRowId: string; reservationId: string; car: string; start: string | null; end: string | null; status: string; total: number | null; earned: number | null; city: string | null }[];
  reviews: { rating: number | null; text: string | null; at: string | null }[];
  profile_data: Record<string, unknown> | null;
  profile_synced_at: string | null;
  our_phone: string | null;
  our_email: string | null;
  our_notes: string | null;
};

export const GUEST_PHOTO_BUCKET = "vertex-turo-guest-photos";

/** Our stored copy of the photo when we have it, else Turo's CDN. */
export function guestPhotoUrl(g: Pick<TuroGuest, "photo_path" | "image_url">): string | null {
  if (g.photo_path) return supabase.storage.from(GUEST_PHOTO_BUCKET).getPublicUrl(g.photo_path).data.publicUrl;
  return g.image_url;
}

const money = (v: unknown) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/** Picks readable fields out of Turo's raw public profile, whatever shape it has. */
function profileFacts(p: Record<string, unknown> | null): [string, string][] {
  if (!p) return [];
  const facts: [string, string][] = [];
  const flat: Record<string, unknown> = {};
  const walk = (o: unknown, prefix: string, depth: number) => {
    if (!o || typeof o !== "object" || depth > 3) return;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) walk(v, key, depth + 1);
      else flat[key] = v;
    }
  };
  walk(p, "", 0);
  const pick = (label: string, re: RegExp, fmt: (v: unknown) => string | null = (v) => (v == null || v === "" ? null : String(v))) => {
    const hit = Object.entries(flat).find(([k, v]) => re.test(k) && v != null && v !== "");
    const val = hit ? fmt(hit[1]) : null;
    if (val) facts.push([label, val]);
  };
  const asDate = (v: unknown) => {
    const d = new Date(typeof v === "number" ? v : String(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  };
  const yes = (v: unknown) => (v === true ? "Sim" : v === false ? "Não" : String(v));
  pick("Membro desde", /(memberSince|joined|dateJoined|createdAt|signupDate)/i, asDate);
  pick("Viagens na Turo (total)", /(tripCount|numberOfTrips|tripsCount|completedTrips)/i);
  pick("Nota como hóspede", /(rating|averageRating|starRating)$/i);
  pick("Avaliações de hosts", /(reviewCount|numberOfReviews|ratingsCount)/i);
  pick("Aprovado para dirigir", /approvedToDrive/i, yes);
  pick("E-mail verificado", /email.*verified|verified.*email/i, yes);
  pick("Telefone verificado", /phone.*verified|verified.*phone/i, yes);
  pick("Mora em", /(location\.city|homeCity|city)$/i);
  pick("Idioma", /languages?$/i);
  pick("Escola/trabalho", /(work|school)$/i);
  pick("Sobre", /(about|bio|description)$/i);
  return facts;
}

type Props = { guest: TuroGuest | null; onClose: () => void; onSaved: (g: TuroGuest) => void };

export function TuroGuestDialog({ guest, onClose, onSaved }: Props) {
  if (!guest) return null;
  // Keyed by guest so the form starts from that guest's saved values.
  return <GuestDialogBody key={guest.renter_id} guest={guest} onClose={onClose} onSaved={onSaved} />;
}

function GuestDialogBody({ guest, onClose, onSaved }: Props & { guest: TuroGuest }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState(guest.our_phone ?? "");
  const [email, setEmail] = useState(guest.our_email ?? "");
  const [notes, setNotes] = useState(guest.our_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const photo = guestPhotoUrl(guest);
  const facts = profileFacts(guest.profile_data);

  async function save() {
    setSaving(true);
    const patch = { our_phone: phone.trim() || null, our_email: email.trim() || null, our_notes: notes.trim() || null, updated_at: new Date().toISOString() };
    // turo_guests isn't in the generated Database types.
    const { error } = await (supabase as unknown as { from: (t: string) => { update: (p: unknown) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } })
      .from("turo_guests")
      .update(patch)
      .eq("renter_id", guest.renter_id);
    setSaving(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Salvo" });
    onSaved({ ...guest, ...patch });
  }

  const stats: [string, string][] = [
    ["Viagens", String(guest.trips_count)],
    ["Canceladas", String(guest.cancelled_count)],
    ["Próximas", String(guest.upcoming_count)],
    ["Dias alugados", String(guest.total_days)],
    ["Total pago", money(guest.total_spent)],
    ["Vocês receberam", money(guest.host_earned)],
    ["Reembolsos", money(guest.reimbursements)],
    ["Milhas rodadas", guest.miles_driven != null ? guest.miles_driven.toLocaleString("en-US") : "—"],
  ];

  return (
    <Dialog open={!!guest} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">{guest.name}</DialogTitle>
        <div className="flex flex-col sm:flex-row gap-5">
          <div className="shrink-0">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={guest.name} className="h-32 w-32 rounded-xl object-cover border" />
            ) : (
              <div className="h-32 w-32 rounded-xl bg-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <h2 className="text-xl font-bold">{guest.name}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-[#efecff] text-[#593cfb] font-semibold">Hóspede Turo</span>
              {guest.photo_verified && (
                <span className="inline-flex items-center gap-1 text-green-700"><ShieldCheck className="h-3.5 w-3.5" /> Foto verificada</span>
              )}
              {guest.avg_rating != null && (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <Star className="h-3.5 w-3.5 fill-current" /> {Number(guest.avg_rating).toFixed(1)} que deu para vocês ({guest.reviews_count})
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Primeira viagem {day(guest.first_trip_at)} · última {day(guest.last_trip_at)}
            </p>
            {guest.cars.length > 0 && <p className="text-sm text-muted-foreground">Alugou: {guest.cars.join(", ")}</p>}
            <div className="flex flex-wrap gap-3 pt-1 text-sm">
              {guest.profile_url && (
                <a href={guest.profile_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#593cfb] hover:underline">
                  Perfil na Turo <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <span className="text-xs text-muted-foreground self-center">ID Turo {guest.renter_id}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-lg border p-2.5">
              <p className="text-[11px] text-muted-foreground">{k}</p>
              <p className="font-semibold">{v}</p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold mb-2">Perfil público na Turo</h3>
          {facts.length ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {facts.map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="text-muted-foreground">{k}:</dt><dd className="min-w-0 break-words">{v}</dd></div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              {guest.profile_data ? "Perfil recebido, sem campos reconhecidos (veja os dados brutos abaixo)." : "Ainda não sincronizado. Vem na próxima sincronização pela extensão ou pelo botão Sincronizar."}
            </p>
          )}
          {guest.profile_data && (
            <button type="button" onClick={() => setShowRaw((v) => !v)} className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRaw ? "rotate-180" : ""}`} /> Dados brutos da Turo
            </button>
          )}
          {showRaw && <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-2 text-[11px]">{JSON.stringify(guest.profile_data, null, 2)}</pre>}
        </div>

        <div className="mt-5 space-y-3 rounded-lg border p-3">
          <h3 className="text-sm font-semibold">Contato e anotações (nossas)</h3>
          <p className="text-xs text-muted-foreground">A Turo não compartilha e-mail nem telefone. Se o hóspede passar, guarde aqui.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 407 555 0100" /></div>
            <div className="space-y-1"><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" /></div>
          </div>
          <div className="space-y-1"><Label>Observações</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: cliente fiel, sempre devolve limpo, prefere SUV…" /></div>
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}Salvar
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-semibold mb-2">Viagens ({guest.trips.length})</h3>
          <div className="divide-y rounded-lg border">
            {guest.trips.map((t) => (
              <Link key={t.tripRowId} href={`/admin/turo?tab=reservations&trip=${t.tripRowId}`} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm hover:bg-muted/40">
                <span className="min-w-0">
                  <span className="font-medium">{t.car}</span>
                  <span className="text-muted-foreground"> · {day(t.start)} → {day(t.end)}{t.city ? ` · ${t.city}` : ""}</span>
                </span>
                <span className="flex items-center gap-3 text-xs">
                  <span className={/cancel/i.test(t.status) ? "text-red-700" : "text-muted-foreground"}>{t.status || "—"}</span>
                  {t.total != null && <span className="font-medium">{money(t.total)}</span>}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {guest.reviews.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold mb-2">Avaliações que deixou para vocês</h3>
            <div className="space-y-2">
              {guest.reviews.map((r, i) => (
                <div key={i} className="rounded-lg border p-2.5 text-sm">
                  <p className="text-amber-700 text-xs">{"★".repeat(Math.round(r.rating ?? 0))} {day(r.at)}</p>
                  {r.text && <p className="mt-1">{r.text}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
