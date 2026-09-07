"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SalesChannelBadge } from "@/components/SalesChannelBadge";
import { Package, Loader2, CheckCircle2, ExternalLink, Search, AlertTriangle } from "lucide-react";
import { getCarrierLogo, normalizeCarrierName, CARRIER_ACCENT } from "@/lib/carrier-utils";
import { loadBoxes, type BoxPreset, type Rate, type OrphanTx, type LabelResult, type ShippoTx } from "@/lib/shippo-types";
import { authedFetch } from "@/lib/admin-fetch";

const fmt = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// Rough similarity so likely matches float to the top of the orphan-Shippo-transaction
// list — exact/substring match scores highest, a shared word scores lower, no overlap at all.
function nameScore(candidateName: string | null, targetName: string): number {
  if (!candidateName || !targetName) return 0;
  const c = normalizeName(candidateName);
  const t = normalizeName(targetName);
  if (!c || !t) return 0;
  if (c === t) return 3;
  if (c.includes(t) || t.includes(c)) return 2;
  const cWords = new Set(c.split(/\s+/));
  if (t.split(/\s+/).some((w) => w.length > 2 && cWords.has(w))) return 1;
  return 0;
}

// Minimal shape used by this dialog — both the Shipping's page `Order` type and OrderForm's
// (loosely-typed) `editingOrder` satisfy this structurally.
export type BuyLabelOrder = {
  id: string;
  canal: string | null;
  frete_total: number | null;
  clients: {
    nome_razao: string;
    endereco_rua: string | null;
    endereco_cidade: string | null;
    endereco_estado: string | null;
    endereco_cep: string | null;
    endereco_pais: string | null;
  } | null;
  order_items: {
    quantidade: number;
    products: { "Produto Nome": string; image_url: string | null } | null;
  }[];
};

type Props = {
  order: BuyLabelOrder | null;
  labelTx: ShippoTx | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
};

export default function BuyLabelDialog({ order, labelTx, open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const [boxes, setBoxes] = useState<BoxPreset[]>([]);
  const [boxId, setBoxId] = useState("");
  const [customLength, setCustomLength] = useState("");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [customUnit, setCustomUnit] = useState<"in" | "cm">("in");
  const [weight, setWeight] = useState("1");
  const [massUnit, setMassUnit] = useState<"lb" | "oz" | "kg" | "g">("lb");
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");
  const [rates, setRates] = useState<Rate[]>([]);
  const [top3Ids, setTop3Ids] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [pendingRate, setPendingRate] = useState<Rate | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [result, setResult] = useState<LabelResult | null>(null);
  const [packedItems, setPackedItems] = useState<Set<number>>(new Set());
  const [orphans, setOrphans] = useState<OrphanTx[] | null>(null);
  const [searchingOrphans, setSearchingOrphans] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [addressValidation, setAddressValidation] = useState<{ is_valid: boolean | null; messages: string[] } | null>(null);
  const [checkingAddress, setCheckingAddress] = useState(false);

  useEffect(() => {
    if (!open || !order) return;
    setRates([]); setTop3Ids(new Set()); setPendingRate(null); setTip(null); setTipLoading(false);
    setResult(null); setWeight("1"); setMassUnit("lb"); setPackedItems(new Set()); setOrphans(null); setAddressValidation(null);
    setCustomLength(""); setCustomWidth(""); setCustomHeight(""); setCustomUnit("in");
    loadBoxes(authedFetch).then((b) => {
      setBoxes(b);
      setBoxId(b[0]?.id ?? "");
    });
    const c = order.clients;
    setName(c?.nome_razao ?? ""); setStreet(c?.endereco_rua ?? ""); setStreet2("");
    setCity(c?.endereco_cidade ?? ""); setState(c?.endereco_estado ?? "");
    setZip(c?.endereco_cep ?? ""); setCountry(c?.endereco_pais ?? "US");
  }, [open, order]);

  const isCustomBox = boxId === "custom";
  const customBoxComplete = !!(customLength && customWidth && customHeight);
  const box: BoxPreset | undefined = isCustomBox
    ? (customBoxComplete
        ? { id: "custom", name: "Custom", length: customLength, width: customWidth, height: customHeight, distance_unit: customUnit }
        : undefined)
    : boxes.find((b) => b.id === boxId);
  const totalItems = order?.order_items?.length ?? 0;
  const allPacked = totalItems === 0 || packedItems.size === totalItems;

  function toggleItemPacked(i: number) {
    setPackedItems((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  // Fastest is recomputed from the full set so it stays correct regardless of array order.
  const fastestId = useMemo(() => {
    if (rates.length === 0) return null;
    return rates.reduce((f, r) => (r.days != null && (!f || f.days == null || r.days < f.days) ? r : f), rates[0]).object_id;
  }, [rates]);

  function payload(extra?: Record<string, string>, overrides?: { weight?: string; box?: BoxPreset }) {
    const w = overrides?.weight ?? weight;
    const b = overrides?.box ?? box!;
    return {
      order_id: order!.id, weight: w, mass_unit: massUnit,
      length: b.length, width: b.width, height: b.height, distance_unit: b.distance_unit,
      address_to: { name, street1: street, street2, city, state, zip, country },
      ...extra,
    };
  }

  async function checkAddress() {
    if (!street || !city || !zip) {
      toast({ title: "Endereço incompleto", description: "Preencha rua, cidade e CEP", variant: "destructive" }); return;
    }
    setCheckingAddress(true); setAddressValidation(null);
    try {
      const res = await authedFetch("/api/shippo/validate-address", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, street1: street, street2, city, state, zip, country }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Erro ao validar endereço", description: data.error, variant: "destructive" }); return; }
      setAddressValidation({ is_valid: data.is_valid, messages: data.messages ?? [] });
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
    finally { setCheckingAddress(false); }
  }

  // Fetches rates for a hypothetical box/weight without touching the dialog's own state —
  // used only to compare against the current selection for the "cheaper alternative" tip.
  async function probeRates(overrides: { weight?: string; box?: BoxPreset }): Promise<Rate[] | null> {
    if (!order) return null;
    const b = overrides.box ?? box;
    if (!b) return null;
    try {
      const res = await authedFetch("/api/shippo/label", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload({}, { weight: overrides.weight, box: b })),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.rates) ? (data.rates as Rate[]) : null;
    } catch { return null; }
  }

  // Real, non-blocking comparison: after the main rates are on screen, quietly check whether
  // a neighboring box size or a slightly lower weight would have come back cheaper — only
  // ever informational, never changes what was already selected/fetched.
  async function checkCheaperAlternatives(currentCheapest: number) {
    setTipLoading(true); setTip(null);
    try {
      const boxIdx = !isCustomBox && box ? boxes.findIndex((b) => b.id === box.id) : -1;
      const altBox = boxIdx > 0 ? boxes[boxIdx - 1] : (boxIdx >= 0 && boxIdx < boxes.length - 1 ? boxes[boxIdx + 1] : null);
      const w = parseFloat(weight);
      const altWeight = Number.isFinite(w) && w > 0.2 ? (w * 0.8).toFixed(1) : null;

      const [boxRates, weightRates] = await Promise.all([
        altBox ? probeRates({ box: altBox }) : Promise.resolve(null),
        altWeight ? probeRates({ weight: altWeight }) : Promise.resolve(null),
      ]);

      const candidates: { amount: number; message: string }[] = [];
      if (boxRates && boxRates.length > 0 && altBox) {
        const cheapest = Math.min(...boxRates.map((r) => parseFloat(r.amount)));
        if (cheapest < currentCheapest - 0.05) {
          candidates.push({ amount: cheapest, message: `Trocando para a caixa "${altBox.name}", a tarifa mais barata cai para ${fmt(cheapest)} — economia de ${fmt(currentCheapest - cheapest)}.` });
        }
      }
      if (weightRates && weightRates.length > 0 && altWeight) {
        const cheapest = Math.min(...weightRates.map((r) => parseFloat(r.amount)));
        if (cheapest < currentCheapest - 0.05) {
          candidates.push({ amount: cheapest, message: `Com ${altWeight} ${massUnit} em vez de ${weight} ${massUnit}, a tarifa mais barata cai para ${fmt(cheapest)} — economia de ${fmt(currentCheapest - cheapest)}.` });
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => a.amount - b.amount);
        setTip(candidates[0].message);
      }
    } finally {
      setTipLoading(false);
    }
  }

  async function fetchRates() {
    if (!order || !box) return;
    if (!street || !city || !zip) {
      toast({ title: "Endereço incompleto", description: "Preencha rua, cidade e CEP", variant: "destructive" }); return;
    }
    setFetching(true); setRates([]); setTop3Ids(new Set()); setTip(null); setAddressValidation(null);
    try {
      const res = await authedFetch("/api/shippo/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await res.json();
      setAddressValidation(data.address_validation ?? null);
      if (!res.ok) { toast({ title: "Erro", description: data.error, variant: "destructive" }); return; }
      const sorted = [...(data.rates as Rate[])].sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));

      // Cheapest of each of the "big 3" carriers, ordered by price — then everything else
      // (remaining services from those carriers, plus any other carrier like DHL) by price.
      const bestByCarrier = new Map<string, Rate>();
      for (const r of sorted) {
        const c = normalizeCarrierName(r.carrier) ?? r.carrier;
        if ((c === "USPS" || c === "UPS" || c === "FedEx") && !bestByCarrier.has(c)) bestByCarrier.set(c, r);
      }
      const top3 = [...bestByCarrier.values()].sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount));
      const top3IdSet = new Set(top3.map((r) => r.object_id));
      const ordered = [...top3, ...sorted.filter((r) => !top3IdSet.has(r.object_id))];

      setRates(ordered);
      setTop3Ids(top3IdSet);
      if (ordered.length > 0) void checkCheaperAlternatives(parseFloat(ordered[0].amount));
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
    finally { setFetching(false); }
  }

  async function buyLabel(rateId: string) {
    if (!order || !box) return;
    setBuying(rateId);
    try {
      const res = await authedFetch("/api/shippo/label", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload({ service_token: rateId })) });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Erro ao gerar etiqueta", description: data.error, variant: "destructive" }); return; }
      setResult(data);
      if (data.warning) {
        toast({ title: "Etiqueta gerada, mas não vinculada ao pedido", description: data.warning, variant: "destructive" });
      } else {
        toast({ title: "Etiqueta gerada!", description: `Rastreio: ${data.tracking_number}` });
      }
      onSuccess();
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
    finally { setBuying(null); }
  }

  async function searchOrphans() {
    setSearchingOrphans(true);
    try {
      const res = await authedFetch("/api/shippo/orphan-transactions");
      const data = await res.json();
      if (!res.ok || data.error) { toast({ title: "Erro ao buscar na Shippo", description: data.error, variant: "destructive" }); return; }
      setOrphans(data.orphans ?? []);
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
    finally { setSearchingOrphans(false); }
  }

  async function linkOrphan(o: OrphanTx) {
    if (!order) return;
    setLinking(o.tracking_number);
    try {
      const res = await authedFetch("/api/shippo/link-transaction", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.id, tracking_number: o.tracking_number, carrier: o.carrier, amount: o.amount }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: "Erro ao vincular", description: data.error, variant: "destructive" }); return; }
      toast({ title: "Pedido vinculado!", description: `Rastreio: ${o.tracking_number}` });
      setOrphans(null);
      onSuccess();
      onOpenChange(false);
    } catch { toast({ title: "Erro de conexão", variant: "destructive" }); }
    finally { setLinking(null); }
  }

  const sortedOrphans = useMemo(() => {
    if (!orphans || !order) return orphans;
    const targetName = order.clients?.nome_razao ?? "";
    return [...orphans].sort((a, b) => nameScore(b.address_to?.name ?? null, targetName) - nameScore(a.address_to?.name ?? null, targetName));
  }, [orphans, order]);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setRates([]); setTop3Ids(new Set()); setPendingRate(null); setTip(null); setResult(null); } }}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-6">
            <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Comprar Etiqueta — {order?.clients?.nome_razao}</DialogTitle>
            {order && (
              <div className="flex items-center gap-1.5 shrink-0 text-xs">
                <span className="text-muted-foreground uppercase tracking-wide">Plataforma:</span>
                <SalesChannelBadge canal={order.canal ?? ""} />
              </div>
            )}
          </div>
        </DialogHeader>
        {order && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">Origem</p>
                <p className="font-medium">Vertex Rental Cars</p>
                <p className="text-muted-foreground">4385 Pebbles Throw Dr</p>
                <p className="text-muted-foreground">Kissimmee, FL 34746 · US</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-2 flex flex-col">
                <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  Produtos do Pedido{" "}
                  {(order.order_items ?? []).length > 0 && (
                    <span className={allPacked ? "text-green-600 normal-case" : "text-amber-500 normal-case"}>
                      ({packedItems.size}/{order.order_items.length} embalados)
                    </span>
                  )}
                </p>
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {(order.order_items ?? []).map((item, i) => (
                    <label key={i} className="flex items-center gap-2.5 cursor-pointer">
                      <Checkbox checked={packedItems.has(i)} onCheckedChange={() => toggleItemPacked(i)} />
                      {item.products?.image_url
                        ? <img src={item.products.image_url} alt="" className="w-12 h-12 rounded-md object-cover border shrink-0" />
                        : <span className="w-12 h-12 rounded-md border bg-background flex items-center justify-center text-muted-foreground shrink-0"><Package className="h-5 w-5" /></span>
                      }
                      <span className="flex-1 text-sm leading-snug line-clamp-2" title={item.products?.["Produto Nome"] ?? undefined}>{item.products?.["Produto Nome"] ?? "Produto"}</span>
                      <span className="text-sm font-semibold shrink-0">×{item.quantidade}</span>
                    </label>
                  ))}
                  {(!order.order_items || order.order_items.length === 0) && (
                    <p className="text-xs text-muted-foreground">Nenhum produto neste pedido</p>
                  )}
                </div>
                <div className="pt-2 mt-auto border-t space-y-1">
                  <p className="text-xs">
                    <span className="text-muted-foreground">Shipping pago pelo cliente:</span>{" "}
                    <strong>{order.frete_total != null ? fmt(order.frete_total) : "—"}</strong>
                  </p>
                  {labelTx ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Já comprado:</span>
                      {(() => { const logo = getCarrierLogo(labelTx.carrier, labelTx.tracking_number); return logo ? <img src={logo} alt={labelTx.carrier ?? ""} className="h-4 w-auto object-contain" /> : <strong>{labelTx.carrier ?? "—"}</strong>; })()}
                      {labelTx.service && <span className="text-muted-foreground">· {labelTx.service}</span>}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma etiqueta comprada ainda para este pedido</p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
                  Destino {!order.clients?.endereco_rua && <span className="text-amber-500 normal-case">(preencha manualmente)</span>}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={checkAddress}
                  disabled={checkingAddress}
                  className="h-7 gap-1.5 text-xs"
                >
                  {checkingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <img src="/images/shippo.png" alt="" className="h-3.5 w-auto object-contain" />}
                  Check Address
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Nome *" value={name} onChange={(e) => setName(e.target.value)} />
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[["US", "United States"], ["BR", "Brazil"], ["CA", "Canada"], ["MX", "Mexico"], ["GB", "United Kingdom"], ["AU", "Australia"], ["DE", "Germany"], ["FR", "France"], ["SA", "Saudi Arabia"]].map(([c, l]) => (
                      <SelectItem key={c} value={c}>{c} — {l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Rua, número *" value={street} onChange={(e) => setStreet(e.target.value)} />
                <Input placeholder="Complemento (apto, bloco…)" value={street2} onChange={(e) => setStreet2(e.target.value)} />
                <Input placeholder="Cidade *" value={city} onChange={(e) => setCity(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Estado" value={state} onChange={(e) => setState(e.target.value)} />
                  <Input placeholder="CEP *" value={zip} onChange={(e) => setZip(e.target.value)} />
                </div>
              </div>
              {addressValidation?.is_valid === false && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium">A Shippo não conseguiu confirmar esse endereço — confira antes de comprar a etiqueta:</p>
                    {addressValidation.messages.length > 0 && (
                      <ul className="list-disc pl-4 mt-1">
                        {addressValidation.messages.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              {addressValidation?.is_valid === true && (
                <p className="text-xs text-green-600 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />Endereço validado pela Shippo
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Caixa/Pacote</Label>
                <Select value={boxId} onValueChange={setBoxId}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {boxes.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        <span className="flex items-center gap-2">
                          {b.image
                            ? <img src={b.image} alt={b.name} className="w-5 h-5 rounded object-cover border shrink-0" />
                            : <span className="w-5 h-5 rounded border bg-muted flex items-center justify-center text-muted-foreground shrink-0"><Package className="h-3 w-3" /></span>
                          }
                          {b.name} <span className="text-muted-foreground font-mono text-xs ml-1">{b.length}×{b.width}×{b.height} {b.distance_unit}</span>
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded border bg-muted flex items-center justify-center text-muted-foreground shrink-0"><Package className="h-3 w-3" /></span>
                        Custom <span className="text-muted-foreground text-xs ml-1">(outro tamanho)</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Peso</Label>
                <div className="flex gap-2">
                  <Input type="number" min="0.1" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  <Select value={massUnit} onValueChange={(v) => setMassUnit(v as "lb" | "oz" | "kg" | "g")}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>{["lb", "oz", "kg", "g"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            {isCustomBox && (
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Comprimento</Label>
                  <Input type="number" min="0.1" step="0.1" value={customLength} onChange={(e) => setCustomLength(e.target.value)} placeholder="L" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Largura</Label>
                  <Input type="number" min="0.1" step="0.1" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} placeholder="W" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Altura</Label>
                  <Input type="number" min="0.1" step="0.1" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} placeholder="H" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Unidade</Label>
                  <Select value={customUnit} onValueChange={(v) => setCustomUnit(v as "in" | "cm")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">in</SelectItem>
                      <SelectItem value="cm">cm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Button className="w-full bg-black hover:bg-black/80 text-white" onClick={fetchRates} disabled={fetching || !box || !allPacked}>
                {fetching ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Buscando tarifas…</> : "Ver tarifas disponíveis"}
              </Button>
              {!allPacked && (
                <p className="text-xs text-amber-500 text-center">Marque todos os produtos como embalados para continuar</p>
              )}
              {isCustomBox && !customBoxComplete && (
                <p className="text-xs text-amber-500 text-center">Preencha comprimento, largura e altura da caixa custom</p>
              )}
            </div>
            {!labelTx && !result && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={searchOrphans}
                  disabled={searchingOrphans}
                  className="text-xs text-muted-foreground hover:text-foreground underline inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {searchingOrphans ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                  Já foi enviado por fora? Buscar etiqueta já comprada na Shippo
                </button>
                {orphans !== null && (
                  <div className="border rounded-lg divide-y max-h-[220px] overflow-y-auto">
                    {sortedOrphans && sortedOrphans.length > 0 ? sortedOrphans.map((o) => {
                      const logo = getCarrierLogo(o.carrier, o.tracking_number);
                      return (
                        <div key={o.tracking_number} className="flex items-center gap-3 p-2.5 text-xs">
                          {logo
                            ? <img src={logo} alt={o.carrier ?? ""} className="h-5 w-auto object-contain shrink-0" />
                            : <span className="w-10 shrink-0 font-medium">{o.carrier ?? "?"}</span>
                          }
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{o.address_to?.name ?? "Endereço desconhecido"}</p>
                            <p className="text-muted-foreground truncate">
                              {o.address_to ? [o.address_to.city, o.address_to.country].filter(Boolean).join(", ") : ""}
                              {o.service ? ` · ${o.service}` : ""}
                              {o.amount ? ` · $${parseFloat(o.amount).toFixed(2)}` : ""}
                            </p>
                          </div>
                          <span className="text-muted-foreground shrink-0">{o.created ? new Date(o.created).toLocaleDateString("pt-BR") : ""}</span>
                          <Button size="sm" variant="outline" className="shrink-0" disabled={linking !== null} onClick={() => linkOrphan(o)}>
                            {linking === o.tracking_number ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Vincular"}
                          </Button>
                        </div>
                      );
                    }) : (
                      <p className="text-center text-xs text-muted-foreground py-4">Nenhuma etiqueta órfã encontrada na Shippo</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {rates.length > 0 && !result && (
              <div className="space-y-2">
                <div className="border rounded-lg divide-y overflow-hidden">
                  {rates.map((r) => {
                    const isTop3 = top3Ids.has(r.object_id);
                    const isFastest = r.object_id === fastestId;
                    const normalized = normalizeCarrierName(r.carrier);
                    const accent = (normalized && (CARRIER_ACCENT as Record<string, string>)[normalized]) || undefined;
                    const logo = getCarrierLogo(r.carrier, null);
                    return (
                      <div
                        key={r.object_id}
                        className="flex items-center gap-3 p-2.5"
                        style={isTop3 && accent ? { backgroundColor: `${accent}14` } : undefined}
                      >
                        <span className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: accent ?? "hsl(var(--muted-foreground) / 0.25)" }} />
                        {logo
                          ? <img src={logo} alt={normalized ?? r.carrier} className="h-6 w-10 object-contain shrink-0" />
                          : <span className="w-10 shrink-0 text-xs font-semibold">{r.carrier}</span>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {r.service}
                            {isTop3 && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: accent }}>Melhor da transportadora</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.days != null ? `${r.days} dia(s) estimado(s)` : "Prazo não informado"}
                            {isFastest && " · Mais rápido"}
                          </p>
                        </div>
                        <span className="text-base font-bold shrink-0">${parseFloat(r.amount).toFixed(2)}</span>
                        <Button
                          size="sm"
                          className="shrink-0 bg-black hover:bg-black/80 text-white"
                          onClick={() => setPendingRate(r)}
                          disabled={buying !== null}
                        >
                          {buying === r.object_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Comprar"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {tipLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />Comparando outras combinações de peso e caixa…
                  </p>
                )}
                {!tipLoading && tip && (
                  <Alert className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20">
                    <AlertDescription className="flex items-start gap-2 text-emerald-800 dark:text-emerald-200">
                      <span className="text-sm leading-none shrink-0" aria-hidden>📉</span>
                      <span>{tip}</span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            {result && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-5 w-5" /><span className="font-semibold">Etiqueta gerada!</span>
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Carrier:</span> <strong>{result.carrier}</strong></p>
                  <p><span className="text-muted-foreground">Serviço:</span> {result.service}</p>
                  <p><span className="text-muted-foreground">Rastreio:</span> <code className="font-mono bg-muted px-1 rounded">{result.tracking_number}</code></p>
                </div>
                <div className="flex gap-2">
                  <Button asChild><a href={result.label_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir Etiqueta (PDF)</a></Button>
                  {result.tracking_url && <Button variant="outline" asChild><a href={result.tracking_url} target="_blank" rel="noopener noreferrer">Rastrear</a></Button>}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>

        {pendingRate && order && (
          <AlertDialog open onOpenChange={(v) => { if (!v) setPendingRate(null); }}>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar compra da etiqueta</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm text-foreground">
                    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {(() => {
                          const logo = getCarrierLogo(pendingRate.carrier, null);
                          return logo
                            ? <img src={logo} alt={pendingRate.carrier} className="h-6 w-10 object-contain shrink-0" />
                            : <span className="text-xs font-semibold shrink-0">{pendingRate.carrier}</span>;
                        })()}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{pendingRate.service}</p>
                          <p className="text-xs text-muted-foreground">{pendingRate.days != null ? `${pendingRate.days} dia(s) estimado(s)` : "Prazo não informado"}</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold shrink-0">${parseFloat(pendingRate.amount).toFixed(2)}</span>
                    </div>

                    {box && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                        {box.image
                          ? <img src={box.image} alt={box.name} className="w-12 h-12 rounded-md object-cover border shrink-0" />
                          : <span className="w-12 h-12 rounded-md border bg-background flex items-center justify-center text-muted-foreground shrink-0"><Package className="h-5 w-5" /></span>
                        }
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Caixa</p>
                          <p className="font-medium truncate">{box.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{box.length}×{box.width}×{box.height} {box.distance_unit} · {weight} {massUnit}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Produtos</p>
                      <div className="flex flex-wrap gap-2">
                        {(order.order_items ?? []).map((item, i) => (
                          <div key={i} className="flex items-center gap-1.5 border rounded-md p-1 pr-2">
                            {item.products?.image_url
                              ? <img src={item.products.image_url} alt="" className="w-8 h-8 rounded object-cover" />
                              : <span className="w-8 h-8 rounded bg-muted flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground" /></span>
                            }
                            <span className="text-xs font-medium">×{item.quantidade}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPendingRate(null)}>Voltar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const rateId = pendingRate.object_id;
                    setPendingRate(null);
                    buyLabel(rateId);
                  }}
                  className="bg-black hover:bg-black/80 text-white"
                >
                  Comprar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
