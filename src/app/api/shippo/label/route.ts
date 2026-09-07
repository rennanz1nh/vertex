import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin-auth";

const SHIPPO_API = "https://api.goshippo.com";
const ORIGIN = {
  name: "Vertex Rental Cars",
  street1: "4385 Pebbles Throw Dr",
  city: "Kissimmee",
  state: "FL",
  zip: "34746",
  country: "US",
  email: "renantadeu94@gmail.com",
  phone: "4079999999",
};

function shippoHeaders() {
  return {
    Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const body = await req.json();
  const { order_id, weight_lb, service_token } = body;

  if (!order_id) {
    return NextResponse.json({ error: "order_id required" }, { status: 400 });
  }

  // Address can be passed directly (for orders without a registered client address)
  // or fetched from Supabase via order_id
  let addressTo: Record<string, string>;

  if (body.address_to) {
    addressTo = body.address_to;
  } else {
    const supabase = getSupabase();
    const { data: order, error } = await supabase
      .from("orders")
      .select(`*, clients (nome_razao, email, telefone, endereco_rua, endereco_cidade, endereco_estado, endereco_cep, endereco_pais)`)
      .eq("id", order_id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const client = order.clients;
    if (!client?.endereco_rua) {
      return NextResponse.json({ error: "Client address not registered" }, { status: 422 });
    }

    addressTo = {
      name: client.nome_razao,
      street1: client.endereco_rua,
      city: client.endereco_cidade || "",
      state: client.endereco_estado || "",
      zip: client.endereco_cep || "",
      country: client.endereco_pais || order.country || "US",
      email: client.email || "",
      phone: client.telefone || "",
    };
  }

  const parcel = {
    length: String(body.length || 12),
    width: String(body.width || 8),
    height: String(body.height || 4),
    distance_unit: body.distance_unit || "in",
    weight: String(body.weight || 1),
    mass_unit: body.mass_unit || "lb",
  };

  // 1. Create shipment to get rates — validate: true asks Shippo to check the destination
  // address (deliverability, typos, missing unit, etc.) and return the result on
  // shipment.address_to.validation_results instead of only failing at carrier handoff time.
  const shipmentRes = await fetch(`${SHIPPO_API}/shipments`, {
    method: "POST",
    headers: shippoHeaders(),
    body: JSON.stringify({
      address_from: ORIGIN,
      address_to: { ...addressTo, validate: true },
      parcels: [parcel],
      async: false,
    }),
  });

  if (!shipmentRes.ok) {
    const err = await shipmentRes.text();
    return NextResponse.json({ error: `Shippo shipment error: ${err}` }, { status: 502 });
  }

  const shipment = await shipmentRes.json();
  const rates: any[] = shipment.rates || [];
  const validationResults = shipment.address_to?.validation_results ?? null;
  const addressValidation = validationResults
    ? {
        is_valid: validationResults.is_valid ?? null,
        messages: (validationResults.messages || []).map((m: any) => m.text).filter(Boolean),
      }
    : null;

  if (rates.length === 0) {
    return NextResponse.json({
      error: "No rates available for this address",
      address_validation: addressValidation,
    }, { status: 422 });
  }

  // If a specific service_token is provided, buy that rate; otherwise just return rates
  if (!service_token) {
    return NextResponse.json({
      shipment_id: shipment.object_id,
      address_validation: addressValidation,
      rates: rates.map((r) => ({
        object_id: r.object_id,
        carrier: r.provider,
        service: r.servicelevel?.name,
        days: r.estimated_days,
        amount: r.amount,
        currency: r.currency,
      })),
    });
  }

  // 2. Buy the label
  const txRes = await fetch(`${SHIPPO_API}/transactions`, {
    method: "POST",
    headers: shippoHeaders(),
    body: JSON.stringify({
      rate: service_token,
      label_file_type: "PDF_4x6",
      async: false,
    }),
  });

  if (!txRes.ok) {
    const err = await txRes.text();
    return NextResponse.json({ error: `Shippo transaction error: ${err}` }, { status: 502 });
  }

  const tx = await txRes.json();

  if (tx.status !== "SUCCESS") {
    return NextResponse.json({
      error: tx.messages?.map((m: any) => m.text).join("; ") || "Label creation failed",
    }, { status: 422 });
  }

  // Save tracking + carrier + actual label cost to order
  const selectedRate = rates.find((r: any) => r.object_id === service_token);
  const supabase = getSupabase();
  const { error: updateError, count } = await supabase
    .from("orders")
    .update({
      shipping_tracking: tx.tracking_number,
      carrier: tx.rate?.provider || null,
      custo_total_shipping: selectedRate ? parseFloat(selectedRate.amount) : null,
    }, { count: "exact" })
    .eq("id", order_id);

  // The Shippo label is real and already paid for either way — never hide it — but if we
  // couldn't save the tracking number onto the order, the UI has no way to know this order
  // shipped (this exact silent failure orphaned a real label from its order once before).
  const orderLinked = !updateError && (count ?? 0) > 0;
  if (!orderLinked) {
    console.error(`[shippo/label] order update failed for order_id=${order_id}, tracking=${tx.tracking_number}:`, updateError?.message ?? "no matching order row");
  }

  return NextResponse.json({
    label_url: tx.label_url,
    tracking_number: tx.tracking_number,
    tracking_url: tx.tracking_url_provider,
    carrier: tx.rate?.provider,
    service: tx.rate?.servicelevel?.name,
    order_linked: orderLinked,
    warning: orderLinked ? undefined : "Etiqueta comprada com sucesso, mas não foi possível salvar o rastreio neste pedido — anote o código manualmente.",
  });
}
