"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EbayAutomationTabs } from "@/components/ebay/EbayAutomationTabs";
import { startEbayReconnect } from "@/components/ebay/EbayConnectionButton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Loader2, HandCoins, Link2, Send, CheckCircle2 } from "lucide-react";
import { authedFetch } from "@/lib/admin-fetch";

type EligibleItem = {
  listingId: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  quantity: number | null;
  image: string | null;
  error: string | null;
};

type SentOffer = {
  id: string;
  listing_id: string;
  title: string | null;
  image: string | null;
  original_price: number | null;
  discount_percentage: number;
  offered_price: number;
  currency: string;
  quantity: number;
  message: string | null;
  sent_at: string;
};

const fmt = (v: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);

function OfferRow({ item, onSent }: { item: EligibleItem; onSent: (listingId: string) => void }) {
  const { toast } = useToast();
  const [discount, setDiscount] = useState(10);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const discountedPrice = item.price ? item.price * (1 - discount / 100) : null;

  async function handleSend() {
    setSending(true);
    try {
      const res = await authedFetch("/api/ebay/negotiation/send-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: item.listingId, discountPercentage: discount, quantity, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          toast({ title: "Conexão eBay expirada", description: "Reautorizando..." });
          await startEbayReconnect(toast);
          return;
        }
        throw new Error(data.error);
      }
      setSent(true);
      toast({ title: "Oferta enviada!", description: `${item.title} — ${fmt(data.price, data.currency)}` });
      onSent(item.listingId);
    } catch (e) {
      toast({ title: "Erro ao enviar oferta", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  if (item.error) {
    return (
      <div className="flex items-center gap-3 py-3 border-b text-sm text-muted-foreground">
        <span className="font-mono text-xs">{item.listingId}</span>
        <span>Falha ao carregar: {item.error}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 py-4 border-b last:border-0">
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt={item.title ?? ""} className="w-16 h-16 object-cover rounded-md border shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.title}</p>
        <p className="text-sm text-muted-foreground">
          Preço atual: {item.price !== null ? fmt(item.price, item.currency ?? "USD") : "—"} · Estoque: {item.quantity ?? "—"}
        </p>

        <div className="flex flex-wrap items-end gap-3 mt-3">
          <div className="space-y-1">
            <Label className="text-xs">Desconto (%)</Label>
            <Input type="number" min={1} max={99} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="w-24" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Validade</Label>
            <div className="h-9 w-24 flex items-center px-2 text-sm text-muted-foreground border rounded-md bg-muted" title="A eBay só aceita 4 dias de validade para ofertas no marketplace dos EUA — valor fixo pela plataforma.">
              4 dias
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantidade</Label>
            <Input type="number" min={1} max={item.quantity ?? 99} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-24" />
          </div>
          <div className="space-y-1 flex-1 min-w-[160px]">
            <Label className="text-xs">Mensagem (opcional)</Label>
            <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensagem para o comprador" maxLength={250} />
          </div>
          <Button size="sm" onClick={handleSend} disabled={sending || sent}>
            {sent ? (
              <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Enviada</>
            ) : sending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Enviando...</>
            ) : (
              <><Send className="h-3.5 w-3.5 mr-1.5" />Enviar oferta</>
            )}
          </Button>
        </div>

        {discountedPrice !== null && !sent && (
          <p className="text-xs text-muted-foreground mt-2">
            Preço com desconto: <span className="font-medium text-foreground">{fmt(discountedPrice, item.currency ?? "USD")}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function EbaySendOfferPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<EligibleItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sentOffers, setSentOffers] = useState<SentOffer[]>([]);
  const [loadingSent, setLoadingSent] = useState(true);

  const fetchSentOffers = () => {
    authedFetch("/api/ebay/negotiation/sent-offers")
      .then((res) => res.json())
      .then((data) => setSentOffers(data.offers ?? []))
      .catch(() => {})
      .finally(() => setLoadingSent(false));
  };

  useEffect(() => {
    authedFetch("/api/ebay/negotiation/eligible-items")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setNeedsReconnect(res.status === 401);
          throw new Error(data.error || "Falha ao carregar");
        }
        setItems(data.items);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar"))
      .finally(() => setLoading(false));

    fetchSentOffers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <HandCoins className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Send Offer</h1>
          <p className="text-muted-foreground text-sm">Anúncios com watchers/carrinho abandonado, elegíveis para receber uma oferta com desconto.</p>
        </div>
      </div>

      <EbayAutomationTabs />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {needsReconnect && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">Reconexão necessária</p>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  Essa funcionalidade usa uma permissão nova (sell.inventory) que sua conexão atual não tem. Reconecte a conta do eBay para liberar.
                </p>
              </div>
              <Button
                className="shrink-0 bg-amber-600 hover:bg-amber-700"
                disabled={connecting}
                onClick={async () => {
                  setConnecting(true);
                  await startEbayReconnect(toast);
                  setConnecting(false);
                }}
              >
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                Reconectar eBay
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ofertas disponíveis</CardTitle>
          <CardDescription>Verificado automaticamente a cada 4 horas — você recebe um push quando um novo anúncio fica elegível.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : !items || items.length === 0 ? (
            !error && <p className="text-sm text-muted-foreground py-8 text-center">Nenhum anúncio elegível no momento.</p>
          ) : (
            <div>
              <Badge variant="secondary" className="mb-2">{items.length} elegível(is)</Badge>
              {items.map((item) => (
                <OfferRow key={item.listingId} item={item} onSent={() => fetchSentOffers()} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="text-muted-foreground">Últimas ofertas enviadas</CardTitle>
          <CardDescription>Histórico dos últimos 30 dias, somente para consulta.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSent ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : sentOffers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma oferta enviada nos últimos 30 dias.</p>
          ) : (
            <div>
              {sentOffers.map((offer) => (
                <div key={offer.id} className="flex items-start gap-4 py-3 border-b last:border-0 text-muted-foreground">
                  {offer.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={offer.image} alt={offer.title ?? ""} className="w-12 h-12 object-cover rounded-md border shrink-0 grayscale" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{offer.title}</p>
                    <p className="text-xs mt-0.5">
                      {fmt(offer.offered_price, offer.currency)} (−{offer.discount_percentage}% de {fmt(offer.original_price ?? offer.offered_price, offer.currency)}) · Qtd: {offer.quantity}
                    </p>
                    {offer.message && <p className="text-xs mt-0.5 italic truncate">&ldquo;{offer.message}&rdquo;</p>}
                  </div>
                  <span className="text-xs shrink-0">
                    {new Date(offer.sent_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
