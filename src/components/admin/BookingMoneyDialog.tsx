"use client";

/**
 * "Reembolsar" and "Cancelar reserva" for website bookings, opened from the Reservas list and
 * from the booking modal. Reads what is still refundable live from Stripe before acting.
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";
import { useConfirm } from "@/components/admin/confirm-dialog";

export type MoneyDialogBooking = {
  id: string;
  label: string;
  /** Paid online through Stripe (has a deposit PaymentIntent that went through). */
  paidOnline: boolean;
  damageHoldStatus?: string | null;
  turoBlocked?: boolean;
};

type RefundChoice = "full" | "partial" | "none";

const usd = (n: number) => `$${n.toFixed(2)}`;

export default function BookingMoneyDialog({
  booking,
  mode,
  onClose,
  onDone,
}: {
  booking: MoneyDialogBooking | null;
  mode: "refund" | "cancel";
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const askConfirm = useConfirm();
  const [refundable, setRefundable] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [choice, setChoice] = useState<RefundChoice>("full");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const open = !!booking;
  useEffect(() => {
    if (!booking) return;
    let alive = true;
    // Reset for the newly opened booking, then read the refundable amount from Stripe.
    Promise.resolve().then(() => {
      if (!alive) return;
      setRefundable(booking.paidOnline ? null : 0);
      setLoadError(null);
      setNote("");
      setAmount("");
      setChoice(booking.paidOnline ? "full" : "none");
    });
    if (!booking.paidOnline) return () => { alive = false; };
    authedFetch(`/api/admin/bookings/${booking.id}/refund`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setLoadError(data.error || "Não foi possível consultar o Stripe.");
          setRefundable(0);
          return;
        }
        const r = Number(data.refundable ?? 0);
        setRefundable(r);
        setAmount(r.toFixed(2));
        if (r <= 0) setChoice("none");
      })
      .catch(() => alive && (setLoadError("Não foi possível consultar o Stripe."), setRefundable(0)));
    return () => {
      alive = false;
    };
  }, [booking]);

  const canRefund = (refundable ?? 0) > 0;
  const partialValue = Number(amount);
  const partialValid = partialValue > 0 && refundable !== null && partialValue <= refundable + 0.001;
  const refundAmountShown = choice === "full" ? refundable ?? 0 : choice === "partial" ? partialValue || 0 : 0;

  async function submit() {
    if (!booking) return;
    if (mode === "refund") {
      if (!partialValid) {
        toast({ title: "Valor inválido", description: `Entre $0.01 e ${usd(refundable ?? 0)}.`, variant: "destructive" });
        return;
      }
      if (!(await askConfirm({ title: `Reembolsar ${usd(partialValue)}?`, description: "O valor volta para o cartão do cliente pelo Stripe. Isso não pode ser desfeito.", confirmText: "Reembolsar", destructive: true }))) return;
    } else {
      if (choice === "partial" && !partialValid) {
        toast({ title: "Valor inválido", description: `Entre $0.01 e ${usd(refundable ?? 0)}.`, variant: "destructive" });
        return;
      }
      const money = choice === "none" ? "sem reembolso" : `com reembolso de ${usd(refundAmountShown)}`;
      if (!(await askConfirm({ title: "Cancelar esta reserva?", description: `${booking.label}, ${money}. Isso não pode ser desfeito.`, confirmText: "Cancelar reserva", cancelText: "Voltar", destructive: true }))) return;
    }
    setBusy(true);
    try {
      const isFull = mode === "refund" && refundable !== null && Math.abs(partialValue - refundable) < 0.005;
      const res =
        mode === "refund"
          ? await authedFetch(`/api/admin/bookings/${booking.id}/refund`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: isFull ? undefined : partialValue, note: note || undefined }),
            })
          : await authedFetch(`/api/admin/bookings/${booking.id}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refund: choice, amount: choice === "partial" ? partialValue : undefined, note: note || undefined }),
            });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        toast({ title: mode === "refund" ? "Reembolso não realizado" : "Não foi possível cancelar", description: data.reason || data.error || "Erro", variant: "destructive" });
        return;
      }
      if (mode === "refund") {
        toast({ title: "Reembolso feito no Stripe", description: `${usd(data.refundedCents / 100)}. O cliente vê no cartão em 5–10 dias úteis.` });
      } else {
        const parts = [
          data.refundedCents > 0 ? `Reembolso de ${usd(data.refundedCents / 100)} feito no Stripe.` : "Sem reembolso.",
          data.holdReleased ? "Caução de $99 liberado." : "",
          data.turoBlocked ? "Lembre de desbloquear as datas na Turo." : "",
        ].filter(Boolean);
        toast({ title: "Reserva cancelada", description: parts.join(" ") });
      }
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const loading = booking?.paidOnline && refundable === null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "refund" ? "Reembolsar pelo Stripe" : "Cancelar reserva"}</DialogTitle>
          <DialogDescription>{booking?.label}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando o Stripe…
          </p>
        ) : (
          <div className="space-y-4">
            {loadError && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{loadError}</p>}
            {booking?.paidOnline && !loadError && (
              <p className="text-sm">
                Disponível para reembolso: <span className="font-semibold">{usd(refundable ?? 0)}</span>
                {!canRefund && <span className="text-muted-foreground"> (já foi todo reembolsado)</span>}
              </p>
            )}
            {!booking?.paidOnline && mode === "cancel" && (
              <p className="text-sm text-muted-foreground">Esta reserva não tem pagamento online no Stripe, então não há o que reembolsar.</p>
            )}

            {mode === "refund" && canRefund && (
              <div>
                <Label className="text-xs">Valor (USD)</Label>
                <Input type="number" inputMode="decimal" step="0.01" min="0.01" max={refundable ?? undefined} value={amount} onChange={(e) => setAmount(e.target.value)} />
                <p className="mt-1 text-[11px] text-muted-foreground">A reserva continua ativa. Para cancelar, use &quot;Cancelar reserva&quot;.</p>
              </div>
            )}

            {mode === "cancel" && canRefund && (
              <div className="space-y-2">
                <Label className="text-xs">Reembolso</Label>
                {(
                  [
                    ["full", `Total (${usd(refundable ?? 0)})`],
                    ["partial", "Parcial"],
                    ["none", "Sem reembolso"],
                  ] as [RefundChoice, string][]
                ).map(([v, l]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="radio" name="refund" checked={choice === v} onChange={() => setChoice(v)} />
                    {l}
                  </label>
                ))}
                {choice === "partial" && (
                  <Input type="number" inputMode="decimal" step="0.01" min="0.01" max={refundable ?? undefined} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Valor em USD" />
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Motivo (opcional)</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: cliente desistiu" />
            </div>

            {mode === "cancel" && (
              <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                <li>O carro volta a ficar livre nessas datas na loja.</li>
                <li>Saldo ainda não cobrado é cancelado.</li>
                {booking?.damageHoldStatus === "held" && <li>O caução de $99 é liberado no cartão.</li>}
                {booking?.turoBlocked && <li>As datas estão bloqueadas na Turo: desbloqueie lá manualmente.</li>}
                <li>O cliente não recebe email automático deste cancelamento.</li>
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Voltar</Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={busy || !!loading || (mode === "refund" && !canRefund)}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "refund" ? "Confirmar reembolso" : "Cancelar reserva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
