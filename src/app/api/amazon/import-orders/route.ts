import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parseAmazonReport, type AmazonReportRow, type ParsedBuyer } from "@/lib/amazon-order-import";
import { requireAdmin } from "@/lib/admin-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type ImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  details: Array<{ orderId: string; outcome: "imported" | "skipped" | "failed"; message?: string }>;
  problems: Array<{ row: number; orderId: string | null; reason: string }>;
  unmappedAsins: string[];
};

/**
 * Upserts the client tied to this order's buyer, mirroring the eBay sync's pattern: dedupe
 * by a stable key (buyer-email here, since Amazon's flat-file has no per-buyer id like eBay's
 * username), update address/contact fields on an existing client, insert a new one otherwise.
 * Returns null when the report row has no buyer-email at all — the order still imports, just
 * without a linked client, same as before this change.
 */
async function upsertAmazonClient(supabase: SupabaseClient, buyer: ParsedBuyer): Promise<string | null> {
  if (!buyer.email) return null;

  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("amazon_buyer_email", buyer.email)
    .maybeSingle();

  if (existing) {
    const upd: Record<string, unknown> = {};
    if (buyer.name) upd.nome_razao = buyer.name;
    if (buyer.phone) upd.telefone = buyer.phone;
    if (buyer.street) upd.endereco_rua = buyer.street;
    if (buyer.city) upd.endereco_cidade = buyer.city;
    if (buyer.state) upd.endereco_estado = buyer.state;
    if (buyer.zip) upd.endereco_cep = buyer.zip;
    if (buyer.country) upd.endereco_pais = buyer.country;
    if (Object.keys(upd).length > 0) {
      await supabase.from("clients").update(upd).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      nome_razao: buyer.name ?? buyer.email,
      tipo: "Cliente Final",
      canal_principal: "Amazon",
      amazon_buyer_email: buyer.email,
      email: buyer.email,
      telefone: buyer.phone,
      endereco_rua: buyer.street,
      endereco_cidade: buyer.city,
      endereco_estado: buyer.state,
      endereco_cep: buyer.zip,
      endereco_pais: buyer.country ?? "US",
    })
    .select("id")
    .single();

  if (error) return null; // best-effort — the order still imports without a linked client
  return created?.id ?? null;
}

/**
 * Imports orders from Amazon's "All Orders" report. Idempotent by design: an order whose
 * amazon-order-id already exists is reported as skipped rather than duplicated, so the same
 * file (or overlapping date-range exports) can be re-uploaded safely.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  let rows: AmazonReportRow[];
  try {
    const body = await request.json();
    rows = Array.isArray(body?.rows) ? body.rows : [];
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma linha encontrada no arquivo." }, { status: 400 });
  }

  const { orders, problems } = parseAmazonReport(rows);
  if (orders.length === 0) {
    return NextResponse.json(
      { error: "Nenhum pedido válido encontrado no arquivo.", problems },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  // Resolve every ASIN in one round trip — products carry the ASIN, so this is the join key.
  const asins = [...new Set(orders.flatMap((o) => o.items.map((i) => i.asin)))];
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select('id, "SKU", "ASIN"')
    .in("ASIN", asins);

  if (productsError) {
    return NextResponse.json({ error: `Falha ao ler produtos: ${productsError.message}` }, { status: 500 });
  }

  const productByAsin = new Map(
    (products ?? [])
      .filter((p) => p.ASIN)
      .map((p) => [String(p.ASIN).trim(), { id: p.id as string, sku: (p.SKU as string) ?? null }])
  );
  const unmappedAsins = asins.filter((a) => !productByAsin.has(a));

  // Existing Amazon orders — the duplicate guard. The DB also has a unique constraint on
  // numero_pedido_canal, but checking up front lets us report "skipped" per order instead
  // of failing the whole batch on the first collision.
  const { data: existing } = await supabase
    .from("orders")
    .select("numero_pedido_canal")
    .eq("canal", "Amazon")
    .in(
      "numero_pedido_canal",
      orders.map((o) => o.numero_pedido_canal)
    );
  const existingIds = new Set((existing ?? []).map((o) => o.numero_pedido_canal));

  const details: ImportResult["details"] = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    if (existingIds.has(order.numero_pedido_canal)) {
      skipped++;
      details.push({ orderId: order.numero_pedido_canal, outcome: "skipped", message: "Já existe no sistema" });
      continue;
    }

    try {
      const clientId = await upsertAmazonClient(supabase, order.buyer);

      const { data: inserted, error: orderError } = await supabase
        .from("orders")
        .insert({
          canal: "Amazon",
          numero_pedido_canal: order.numero_pedido_canal,
          data_pedido: order.data_pedido,
          status: order.status,
          status_manual: false,
          total: order.total,
          frete_total: order.frete_total,
          impostos: order.impostos,
          descontos: order.descontos,
          comissao_ebay: order.comissao,
          promoted_listings: 0,
          diferente: 0,
          endereco_completo: order.endereco_completo,
          country: order.country,
          client_id: clientId,
          buyer_email: order.buyer.email,
        })
        .select("id")
        .single();

      if (orderError) throw new Error(orderError.message);

      const itemRows = order.items.map((item) => {
        const product = productByAsin.get(item.asin);
        return {
          order_id: inserted!.id,
          product_id: product?.id ?? null,
          sku: product?.sku ?? null,
          asin: item.asin,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          custo_unitario: 0,
          imposto_unitario: item.imposto_unitario,
          frete_unitario: 0,
        };
      });

      const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
      if (itemsError) {
        // Don't leave a headless order behind if its items failed to save.
        await supabase.from("orders").delete().eq("id", inserted!.id);
        throw new Error(`itens: ${itemsError.message}`);
      }

      imported++;
      details.push({ orderId: order.numero_pedido_canal, outcome: "imported" });
    } catch (e: unknown) {
      failed++;
      details.push({
        orderId: order.numero_pedido_canal,
        outcome: "failed",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const result: ImportResult = { imported, skipped, failed, details, problems, unmappedAsins };
  return NextResponse.json(result);
}
