// Single source of truth for order money math, used by BOTH the order form (OrderForm)
// and the Pedidos table (Orders.tsx) so the same order can never show two different
// profit numbers. TAX is informational only — the user fills it as a reference, but it
// never adds to the total nor subtracts from profit.

// Difference (in $) between the informed total and the sum of its parts that we tolerate
// before flagging an order for manual review. Small rounding gaps are expected; a whole
// dollar or more usually means the order was only half-filled (e.g. an Amazon order the
// user completes by hand) or the platform total doesn't reconcile.
export const TOTAL_MISMATCH_THRESHOLD = 1.0;

export type OrderCalcInput = {
  valorProdutos: number;      // Σ quantidade × preço unitário
  valorCusto: number;         // Σ quantidade × custo unitário
  shippingPagoCliente: number; // frete_total — what the buyer paid for shipping
  custoTotalShipping: number;  // the real label cost
  comissao: number;            // platform commission (comissao_ebay)
  promotedListings: number;
  desconto: number;            // descontos
  tax: number;                 // impostos — INFORMATIONAL ONLY, not used in any math below
  // Optional: the total already stored/informed for this order (order.total). When present,
  // it's compared against the computed total to detect mismatches. Omit for brand-new orders.
  totalInformado?: number | null;
};

export type OrderCalcResult = {
  valorProdutos: number;     // Σ quantidade × preço unitário (products only)
  valorTotalVenda: number;   // produtos + shipping − desconto (NO tax)
  valorCusto: number;
  lucroFinal: number;        // total − custo − envio − comissão − promoted (NO tax)
  percentualLucro: number;
  totalDeducoes: number;     // sum of everything subtracted from the sale
  tax: number;               // echoed back for display (informational)
  // Mismatch check (only meaningful when totalInformado was provided):
  hasTotalInformado: boolean;
  totalDivergente: boolean;  // true when |totalInformado − valorTotalVenda| ≥ threshold
  diferencaTotal: number;    // totalInformado − valorTotalVenda (signed), 0 when no informado
};

export function calcularPedido(input: OrderCalcInput): OrderCalcResult {
  const valorProdutos = input.valorProdutos || 0;
  const valorCusto = input.valorCusto || 0;
  const shipping = input.shippingPagoCliente || 0;
  const custoEnvio = input.custoTotalShipping || 0;
  const comissao = input.comissao || 0;
  const promoted = input.promotedListings || 0;
  const desconto = input.desconto || 0;
  const tax = input.tax || 0;

  // Sale total the buyer paid, WITHOUT tax (tax is a pass-through, informational only).
  const valorTotalVenda = valorProdutos + shipping - desconto;

  const totalDeducoes = valorCusto + custoEnvio + comissao + promoted;
  const lucroFinal = valorTotalVenda - totalDeducoes;
  const percentualLucro = valorTotalVenda > 0 ? (lucroFinal / valorTotalVenda) * 100 : 0;

  const hasTotalInformado = input.totalInformado != null;
  const diferencaTotal = hasTotalInformado ? (input.totalInformado as number) - valorTotalVenda : 0;
  const totalDivergente = hasTotalInformado && Math.abs(diferencaTotal) >= TOTAL_MISMATCH_THRESHOLD;

  return {
    valorProdutos,
    valorTotalVenda,
    valorCusto,
    lucroFinal,
    percentualLucro,
    totalDeducoes,
    tax,
    hasTotalInformado,
    totalDivergente,
    diferencaTotal,
  };
}

// Convenience: build the calc input from a DB `order` row (as read in Orders.tsx), where
// item costs/prices come from order_items. Keeps the table and the form on the same math.
//
// `shippoFallbackAmount` covers orders where a label was actually bought via Shippo but
// `custo_total_shipping` never got persisted to the order row (it's only written back when
// the order form is opened AND saved) — without this, every such order shows an inflated
// profit until someone happens to open and save it by hand. Pass the matching Shippo
// transaction's `amount` (e.g. `shippoTxMap[order.shipping_tracking]?.amount`) from any
// caller that already has that map loaded; omit it where the map isn't available and the
// DB value is used as-is.
export function calcularPedidoFromDbOrder(order: {
  order_items?: { quantidade?: number; preco_unitario?: number; custo_unitario?: number; product_id?: string | null; products?: unknown | null }[] | null;
  total?: number | null;
  frete_total?: number | null;
  custo_total_shipping?: number | null;
  comissao_ebay?: number | null;
  promoted_listings?: number | null;
  descontos?: number | null;
  impostos?: number | null;
}, shippoFallbackAmount?: number | string | null): OrderCalcResult & { produtoNaoIdentificado: boolean; precisaConferir: boolean } {
  const items = order.order_items || [];
  const valorProdutos = items.reduce((s, it) => s + (it.quantidade || 0) * (it.preco_unitario || 0), 0);
  const valorCusto = items.reduce((s, it) => s + (it.quantidade || 0) * (it.custo_unitario || 0), 0);

  const custoTotalShipping = order.custo_total_shipping || parseFloat(String(shippoFallbackAmount ?? 0)) || 0;

  const base = calcularPedido({
    valorProdutos,
    valorCusto,
    shippingPagoCliente: order.frete_total || 0,
    custoTotalShipping,
    comissao: order.comissao_ebay || 0,
    promotedListings: order.promoted_listings || 0,
    desconto: order.descontos || 0,
    tax: order.impostos || 0,
    totalInformado: order.total ?? null,
  });

  // An item with no linked product (e.g. an eBay line that synced with no SKU match) shows
  // as "N/A" and needs a human to pick the right product — flag it for review too.
  const produtoNaoIdentificado = items.length === 0 || items.some((it) => !it.product_id && !it.products);
  const precisaConferir = base.totalDivergente || produtoNaoIdentificado;

  return { ...base, produtoNaoIdentificado, precisaConferir };
}
