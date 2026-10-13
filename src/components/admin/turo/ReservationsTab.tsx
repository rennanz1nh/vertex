import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Search, ExternalLink, MapPin, Car as CarIcon, User, Calendar, Clock, DollarSign } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";
import { TuroTrip, TuroExtras, StatusBadge, vehicleLabel, fmtDateTime, fmtDate, durationDays, fmtMoney, buildFinanceIndex } from "./shared";

type RawObj = Record<string, unknown>;
function get(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur && typeof cur === "object") cur = (cur as RawObj)[k];
    else return undefined;
  }
  return cur;
}
function s(v: unknown): string | null {
  return typeof v === "string" && v ? v : typeof v === "number" ? String(v) : null;
}

function VehicleThumb({ url, size = 40 }: { url: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div className="rounded-md bg-muted flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <CarIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onError={() => setErr(true)} className="rounded-md object-cover shrink-0" style={{ width: size, height: size }} />;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium break-words">{children}</span>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 45% 45%)`;
}

// Full-width banner photo with graceful fallback (Turo serves some .heic that
// browsers can't render — fall back to a branded gradient block).
function Banner({ url }: { url: string | null }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div className="w-full h-44 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
        <CarIcon className="h-12 w-12 text-white/40" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" onError={() => setErr(true)} className="w-full h-44 object-cover" />;
}

function MiniStat({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" /> {label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent ? "text-emerald-700" : ""}`}>{value}</p>
    </div>
  );
}

function DetailDialog({ tripId, earned, onClose }: { tripId: string | null; earned?: number; onClose: () => void }) {
  const [detail, setDetail] = useState<TuroTrip & { raw_data?: RawObj } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tripId) { setDetail(null); return; }
    let active = true;
    setLoading(true);
    authedFetch(`/api/admin/turo/trips/${tripId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setDetail(d?.trip ?? null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tripId]);

  const raw = detail?.raw_data ?? {};
  const vehicleUrl = s(get(raw, "vehicle", "url"));
  const renterUrl = s(get(raw, "renter", "url"));
  const address = s(get(raw, "location", "address"));
  const regState = s(get(raw, "vehicle", "registration", "state"));
  const guest = detail?.guest_name || "Hóspede";

  return (
    <Dialog open={!!tripId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
        <DialogTitle className="sr-only">{detail ? vehicleLabel(detail) : "Reserva"}</DialogTitle>
        {loading && !detail && <p className="text-sm text-muted-foreground py-16 text-center">Carregando...</p>}
        {detail && (
          <>
            {/* Banner */}
            <div className="relative shrink-0">
              <Banner url={detail.vehicle_image_url} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <StatusBadge status={detail.status} />
                  <h2 className="text-white text-xl font-bold mt-1 truncate drop-shadow">{vehicleLabel(detail)}{detail.vehicle_trim ? ` ${detail.vehicle_trim}` : ""}</h2>
                  <p className="text-white/80 text-xs">{[detail.location_city, detail.location_state].filter(Boolean).join(", ")}</p>
                </div>
                {earned != null && earned > 0 && (
                  <div className="shrink-0 bg-white/95 rounded-lg px-3 py-1.5 text-right">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ganhos</p>
                    <p className="text-lg font-bold text-emerald-700 tabular-nums leading-none">{fmtMoney(earned)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 overflow-y-auto">
              {/* Mini stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <MiniStat icon={Calendar} label="Retirada" value={fmtDate(detail.pickup_date)} />
                <MiniStat icon={Calendar} label="Devolução" value={fmtDate(detail.return_date)} />
                <MiniStat icon={Clock} label="Duração" value={`${durationDays(detail.pickup_date, detail.return_date)} dias`} />
                <MiniStat icon={DollarSign} label="Ganhos" value={earned ? fmtMoney(earned) : "—"} accent={!!earned} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Guest */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Hóspede</h3>
                  <div className="flex items-center gap-3">
                    <span className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ background: avatarColor(guest) }}>{initials(guest)}</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{guest}</p>
                      {renterUrl && (
                        <a href={renterUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 text-xs inline-flex items-center gap-1">
                          Ver perfil no Turo <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </section>

                {/* Reservation times */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Período</h3>
                  <Row label="Retirada">{fmtDateTime(detail.pickup_date)}</Row>
                  <Row label="Devolução">{fmtDateTime(detail.return_date)}</Row>
                  <Row label="ID Turo">{detail.turo_trip_id}</Row>
                </section>

                {/* Vehicle */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><CarIcon className="h-3.5 w-3.5" /> Veículo</h3>
                  {detail.vehicle_type && <Row label="Tipo">{detail.vehicle_type}</Row>}
                  {detail.vehicle_vin && <Row label="VIN">{detail.vehicle_vin}</Row>}
                  {detail.vehicle_license_plate && <Row label="Placa">{detail.vehicle_license_plate}{regState ? ` (${regState})` : ""}</Row>}
                  <Row label="Na frota">{detail.product_id ? <Badge className="bg-green-100 text-green-800 border-green-200 border">Sim</Badge> : <Badge variant="outline">Não</Badge>}</Row>
                  {vehicleUrl && (
                    <Row label="Anúncio">
                      <a href={vehicleUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 inline-flex items-center gap-1">Ver no Turo <ExternalLink className="h-3 w-3" /></a>
                    </Row>
                  )}
                </section>

                {/* Location */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Local</h3>
                  <Row label="Cidade">{[detail.location_city, detail.location_state].filter(Boolean).join(", ") || "—"}</Row>
                  {address && <Row label="Endereço">{address}</Row>}
                  {detail.location_lat != null && detail.location_lng != null && (
                    <Row label="Mapa">
                      <a href={`https://maps.google.com/?q=${detail.location_lat},${detail.location_lng}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 inline-flex items-center gap-1">Abrir <ExternalLink className="h-3 w-3" /></a>
                    </Row>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReservationsTab({ trips, extras }: { trips: TuroTrip[]; extras: TuroExtras | null }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const now = Date.now();
  const fin = useMemo(() => buildFinanceIndex(extras), [extras]);
  const statuses = useMemo(() => {
    const set = new Set(trips.map((t) => t.status).filter(Boolean));
    return [...set].sort();
  }, [trips]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return trips.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (period !== "all" && t.pickup_date) {
        const ps = new Date(t.pickup_date).getTime();
        if (period === "upcoming" && ps < now) return false;
        if (period === "history" && ps >= now) return false;
      }
      if (needle) {
        const hay = [t.guest_name, vehicleLabel(t), t.vehicle_vin, t.vehicle_license_plate, t.turo_trip_id, t.location_city]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [trips, q, statusFilter, period, now]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar hóspede, carro, placa, VIN, ID..." className="pl-8" />
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os períodos</SelectItem>
            <SelectItem value="upcoming">Próximas</SelectItem>
            <SelectItem value="history">Histórico</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {statuses.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">{filtered.length} de {trips.length} reserva(s)</p>
        {fin.byReservation.size > 0 && (
          <p className="text-xs text-muted-foreground">
            Receita listada: <span className="text-emerald-700 font-semibold">{fmtMoney(filtered.reduce((s, t) => s + (fin.byReservation.get(t.turo_trip_id) ?? 0), 0))}</span>
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="p-3 font-medium">Veículo</th>
              <th className="p-3 font-medium">Hóspede</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium whitespace-nowrap">Retirada</th>
              <th className="p-3 font-medium whitespace-nowrap">Devolução</th>
              <th className="p-3 font-medium">Dias</th>
              <th className="p-3 font-medium text-right">Ganhos</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma reserva encontrada.</td></tr>
            ) : filtered.map((t) => {
              const earned = fin.byReservation.get(t.turo_trip_id);
              return (
                <tr key={t.id} onClick={() => setOpenId(t.id)} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <VehicleThumb url={t.vehicle_image_url} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{vehicleLabel(t)}</p>
                        {t.vehicle_license_plate && <p className="text-[11px] text-muted-foreground">{t.vehicle_license_plate}</p>}
                      </div>
                      {!t.product_id && <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 ml-1">Turo</Badge>}
                    </div>
                  </td>
                  <td className="p-3">{t.guest_name || "—"}</td>
                  <td className="p-3"><StatusBadge status={t.status} /></td>
                  <td className="p-3 whitespace-nowrap">{fmtDate(t.pickup_date)}</td>
                  <td className="p-3 whitespace-nowrap">{fmtDate(t.return_date)}</td>
                  <td className="p-3 tabular-nums">{durationDays(t.pickup_date, t.return_date)}</td>
                  <td className="p-3 text-right tabular-nums font-medium">{earned ? <span className="text-emerald-700">{fmtMoney(earned)}</span> : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DetailDialog tripId={openId} earned={openId ? fin.byReservation.get(trips.find((t) => t.id === openId)?.turo_trip_id ?? "") : undefined} onClose={() => setOpenId(null)} />
    </div>
  );
}
