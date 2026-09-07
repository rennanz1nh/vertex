// Parses Amazon's "All Orders" flat-file report (Seller Central > Reports) into the shape
// our orders/order_items tables use. Pure functions, no I/O — the API route does the DB work.
//
// This exists because the Amazon SP-API requires a Professional seller plan; on the
// Individual plan the report download is the only way to get order data out, so historical
// sales are imported from the spreadsheet instead of synced automatically.

/** Raw row straight out of the report (one row = one line item, not one order). */
export type AmazonReportRow = Record<string, unknown>;

export type ParsedOrderItem = {
  asin: string;
  quantidade: number;
  /** Amazon reports item-price as the LINE total (price x qty); we store true unit price. */
  preco_unitario: number;
  imposto_unitario: number;
  /** Amazon's per-line id — used to dedupe repeated lines within one order. */
  orderItemId: string | null;
};

export type ParsedBuyer = {
  /** Dedupe key — Amazon's flat-file report has no stable per-buyer id like eBay's
   *  username, so email is the closest thing to one. Orders with no buyer-email (blank
   *  in the report for some marketplaces/order types) just don't get a linked client. */
  email: string | null;
  name: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
};

export type ParsedOrder = {
  numero_pedido_canal: string;
  data_pedido: string; // YYYY-MM-DD
  status: string;
  /** Sum of item-price across lines — the "valor dos produtos" the 15% fee applies to. */
  valorProdutos: number;
  frete_total: number;
  /** Informational only: the DB recomputes `impostos` and `total` from the order's items
   *  via the calculate_order_totals trigger, so whatever is inserted here is overwritten.
   *  Kept so the import summary can show the expected figures. */
  impostos: number;
  descontos: number;
  comissao: number;
  total: number;
  endereco_completo: string | null;
  country: string | null;
  buyer: ParsedBuyer;
  items: ParsedOrderItem[];
};

export type RowProblem = { row: number; orderId: string | null; reason: string };

/** Amazon takes a referral fee per sale; 15% is the rate for this catalog's categories.
 *  Applied to the product subtotal only (not shipping or tax), matching how Amazon bills. */
export const AMAZON_REFERRAL_FEE_RATE = 0.15;

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Amazon's `item-status` describes fulfillment (what we show as the status dot);
 * `order-status` describes the payment/lifecycle state. Cancellation only ever shows up in
 * order-status (a cancelled line has item-status empty), so it's checked first.
 */
function mapStatus(orderStatus: string | null, itemStatus: string | null): string {
  if (orderStatus?.toLowerCase() === "cancelled" || orderStatus?.toLowerCase() === "canceled") {
    return "Cancelado";
  }
  switch (itemStatus?.toLowerCase()) {
    case "shipped":
      return "Enviado";
    case "unshipped":
      return "Pronto para Envio";
    default:
      return "Pronto para Envio";
  }
}

function buildAddress(row: AmazonReportRow): string | null {
  const parts = [
    str(row["ship-city"]),
    str(row["ship-state"]),
    str(row["ship-postal-code"]),
    str(row["ship-country"]),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** recipient-name is who the package is addressed to (may be a different household member
 *  than the account holder); buyer-name is who actually placed the order — prefer the buyer
 *  since that's who we'd contact, falling back to recipient when buyer-name is blank. */
function buildBuyer(row: AmazonReportRow): ParsedBuyer {
  const street = [str(row["ship-address-1"]), str(row["ship-address-2"])].filter(Boolean).join(", ") || null;
  return {
    email: str(row["buyer-email"]),
    name: str(row["buyer-name"]) ?? str(row["recipient-name"]),
    phone: str(row["buyer-phone-number"]) ?? str(row["ship-phone-number"]),
    street,
    city: str(row["ship-city"]),
    state: str(row["ship-state"]),
    zip: str(row["ship-postal-code"]),
    country: str(row["ship-country"]),
  };
}

/**
 * Groups the report's line-item rows into orders. Rows missing an order id or an ASIN are
 * reported as problems rather than silently dropped — a silently skipped sale is worse than
 * a visible error, since the operator has no other way to notice it went missing.
 */
export function parseAmazonReport(rows: AmazonReportRow[]): {
  orders: ParsedOrder[];
  problems: RowProblem[];
} {
  const problems: RowProblem[] = [];
  const byOrderId = new Map<string, AmazonReportRow[]>();

  rows.forEach((row, i) => {
    const rowNum = i + 2; // +2: 1-based, and row 1 is the header
    const orderId = str(row["amazon-order-id"]);
    if (!orderId) {
      problems.push({ row: rowNum, orderId: null, reason: "Linha sem amazon-order-id" });
      return;
    }
    if (!str(row["asin"])) {
      problems.push({ row: rowNum, orderId, reason: "Linha sem ASIN — não dá para vincular o produto" });
      return;
    }
    const list = byOrderId.get(orderId);
    if (list) list.push(row);
    else byOrderId.set(orderId, [row]);
  });

  const orders: ParsedOrder[] = [];

  for (const [orderId, orderRows] of byOrderId) {
    const first = orderRows[0];

    const purchaseDate = str(first["purchase-date"]);
    if (!purchaseDate) {
      problems.push({ row: 0, orderId, reason: "Pedido sem purchase-date" });
      continue;
    }
    // The report gives an ISO timestamp in UTC. `data_pedido` is meant to be "the
    // calendar day of the sale" for the business, which runs on US Eastern time — a
    // sale near midnight UTC can land on a different day than it did for the seller,
    // and silently drop off the dashboard's "Hoje" filter until UTC catches up.
    const data_pedido = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(purchaseDate));

    const isCancelled = str(first["order-status"])?.toLowerCase().startsWith("cancel") ?? false;

    let valorProdutos = 0;
    let impostos = 0;
    let frete_total = 0;
    let descontos = 0;
    const items: ParsedOrderItem[] = [];
    const seenItemIds = new Set<string>();

    for (const row of orderRows) {
      const orderItemId = str(row["order-item-id"]);
      // Guards against the same line appearing twice when several report blocks overlap.
      if (orderItemId && seenItemIds.has(orderItemId)) continue;
      if (orderItemId) seenItemIds.add(orderItemId);

      const quantidade = Math.trunc(num(row["quantity"]));
      const lineTotal = num(row["item-price"]);
      // Amazon reports the sales tax split in two (goods vs. shipping); both are money the
      // buyer paid, and the DB derives an order's `impostos` purely from its items
      // (calculate_order_totals trigger), so they have to be combined here or the shipping
      // portion silently vanishes from the order total.
      const lineTax = num(row["item-tax"]) + num(row["shipping-tax"]);

      valorProdutos += lineTotal;
      impostos += lineTax;
      frete_total += num(row["shipping-price"]);
      descontos += Math.abs(num(row["item-promotion-discount"]));

      items.push({
        asin: str(row["asin"])!,
        quantidade,
        // Cancelled lines come back with quantity 0 and no price — dividing would be a
        // division by zero, so those legitimately land on 0.
        preco_unitario: quantidade > 0 ? round2(lineTotal / quantidade) : 0,
        imposto_unitario: quantidade > 0 ? round2(lineTax / quantidade) : 0,
        orderItemId,
      });
    }

    // A cancelled order earns nothing: Amazon zeroes the amounts, and no referral fee is
    // charged, so it stays in the history at zero rather than inflating revenue.
    const comissao = isCancelled ? 0 : round2(valorProdutos * AMAZON_REFERRAL_FEE_RATE);
    const total = round2(valorProdutos + frete_total - descontos + impostos);

    orders.push({
      numero_pedido_canal: orderId,
      data_pedido,
      status: mapStatus(str(first["order-status"]), str(first["item-status"])),
      valorProdutos: round2(valorProdutos),
      frete_total: round2(frete_total),
      impostos: round2(impostos),
      descontos: round2(descontos),
      comissao,
      total,
      endereco_completo: buildAddress(first),
      country: str(first["ship-country"]),
      buyer: buildBuyer(first),
      items,
    });
  }

  return { orders, problems };
}
