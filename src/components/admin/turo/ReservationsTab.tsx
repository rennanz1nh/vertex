import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, ExternalLink, MapPin, Car as CarIcon, User } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";
import { TuroTrip, StatusBadge, vehicleLabel, fmtDateTime, fmtDate, durationDays } from "./shared";

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

function DetailSheet({ tripId, onClose }: { tripId: string | null; onClose: () => void }) {
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

  return (
    <Sheet open={!!tripId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {loading && <p className="text-sm text-muted-foreground py-8 text-center">Carregando...</p>}
        {detail && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="flex items-center gap-2">
                <VehicleThumb url={detail.vehicle_image_url} size={44} />
                <div className="min-w-0">
                  <p className="truncate">{vehicleLabel(detail)}</p>
                  <div className="mt-1"><StatusBadge status={detail.status} /></div>
                </div>
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-5">
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5"><CarIcon className="h-3.5 w-3.5" /> Reserva</h3>
                <Row label="ID Turo">{detail.turo_trip_id}</Row>
                <Row label="Retirada">{fmtDateTime(detail.pickup_date)}</Row>
                <Row label="Devolução">{fmtDateTime(detail.return_date)}</Row>
                <Row label="Duração">{durationDays(detail.pickup_date, detail.return_date)} dia(s)</Row>
                {detail.earnings_amount != null && <Row label="Ganhos">{`$${detail.earnings_amount.toFixed(2)}`}</Row>}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Hóspede</h3>
                <Row label="Nome">{detail.guest_name || "—"}</Row>
                {renterUrl && (
                  <Row label="Perfil">
                    <a href={renterUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 inline-flex items-center gap-1">
                      Ver no Turo <ExternalLink className="h-3 w-3" />
                    </a>
                  </Row>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5"><CarIcon className="h-3.5 w-3.5" /> Veículo</h3>
                <Row label="Modelo">{vehicleLabel(detail)}{detail.vehicle_trim ? ` ${detail.vehicle_trim}` : ""}</Row>
                {detail.vehicle_type && <Row label="Tipo">{detail.vehicle_type}</Row>}
                {detail.vehicle_vin && <Row label="VIN">{detail.vehicle_vin}</Row>}
                {detail.vehicle_license_plate && <Row label="Placa">{detail.vehicle_license_plate}{regState ? ` (${regState})` : ""}</Row>}
                <Row label="Cadastrado">{detail.product_id ? <Badge className="bg-green-100 text-green-800 border-green-200 border">Sim</Badge> : <Badge variant="outline">Não</Badge>}</Row>
                {vehicleUrl && (
                  <Row label="Anúncio">
                    <a href={vehicleUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 inline-flex items-center gap-1">
                      Ver no Turo <ExternalLink className="h-3 w-3" />
                    </a>
                  </Row>
                )}
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Local</h3>
                <Row label="Cidade">{[detail.location_city, detail.location_state].filter(Boolean).join(", ") || "—"}</Row>
                {address && <Row label="Endereço">{address}</Row>}
                {detail.location_lat != null && detail.location_lng != null && (
                  <Row label="Mapa">
                    <a href={`https://maps.google.com/?q=${detail.location_lat},${detail.location_lng}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 inline-flex items-center gap-1">
                      Abrir <ExternalLink className="h-3 w-3" />
                    </a>
                  </Row>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ReservationsTab({ trips }: { trips: TuroTrip[] }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const now = Date.now();
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

      <p className="text-xs text-muted-foreground">{filtered.length} de {trips.length} reserva(s)</p>

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
              <th className="p-3 font-medium">Local</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhuma reserva encontrada.</td></tr>
            ) : filtered.map((t) => (
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
                <td className="p-3">{[t.location_city, t.location_state].filter(Boolean).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DetailSheet tripId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
