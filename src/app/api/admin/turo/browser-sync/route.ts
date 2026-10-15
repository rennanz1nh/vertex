// Receives pre-fetched Turo trip data from the browser (which can call turo.com
// directly using the user's own cookies) and stores it in Supabase.
// Accepts either JWT admin auth OR a one-time sync token (X-Sync-Token header)
// so a console script running on turo.com can POST here cross-origin.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireMasterAdmin } from "@/lib/admin-auth";
import { collectTrips, linkTrips, upsertTrips, fillCarInfoFromTuro, type RawTrip } from "@/lib/turo-trips";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://turo.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Token, X-Sync-Key",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

// "$323.32" -> 323.32, "- $35.93" -> -35.93
function parseMoney(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return null;
  return /^\s*-/.test(v) ? -n : n;
}

type LineItem = { label?: string; value?: string; receiptLineItemType?: string };

function parseReceipt(id: string, data: RawTrip) {
  const cost = (data.costDetailLineItems as LineItem[]) ?? [];
  const earn = (data.earningLineItems as LineItem[]) ?? [];
  const total = cost.find((i) => i.receiptLineItemType === "TOTAL_AMOUNT");
  const fee = earn.find((i) => /turo fee/i.test(i.label ?? ""));
  const earned = earn.find((i) => i.receiptLineItemType === "TOTAL_EARNED");
  const feeVal = parseMoney(fee?.value);
  return {
    reservation_id: id,
    data,
    trip_total: parseMoney(total?.value),
    turo_fee: feeVal != null ? Math.abs(feeVal) : null,
    host_earned: parseMoney(earned?.value),
    fetched_at: new Date().toISOString(),
  };
}

async function verifySyncToken(supabase: ReturnType<typeof adminClient>, token: string): Promise<string | null> {
  const { data } = await supabase
    .from("turo_tokens")
    .select("id, sync_token, sync_token_expires_at")
    .eq("sync_token", token)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  if (!data.sync_token_expires_at) return null;
  if (new Date(data.sync_token_expires_at as string) < new Date()) return null;
  return data.id as string;
}

// Permanent sync key (UUID stored in DB): no expiry, used for bookmarklet
async function verifySyncKey(supabase: ReturnType<typeof adminClient>, key: string): Promise<string | null> {
  const { data } = await supabase
    .from("turo_tokens")
    .select("id, sync_key")
    .eq("sync_key", key)
    .limit(1)
    .maybeSingle();
  return data ? (data.id as string) : null;
}

export async function POST(request: NextRequest) {
  const supabase = adminClient();
  let tokenRowId: string | null = null;

  // Check permanent sync key first (bookmarklet)
  const syncKey = request.headers.get("X-Sync-Key");
  if (syncKey) {
    tokenRowId = await verifySyncKey(supabase, syncKey);
    if (!tokenRowId) {
      return new NextResponse(
        JSON.stringify({ error: "Sync key inválida" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  } else {
    // Check one-time sync token (console script fallback)
    const syncToken = request.headers.get("X-Sync-Token");
    if (syncToken) {
      tokenRowId = await verifySyncToken(supabase, syncToken);
      if (!tokenRowId) {
        return new NextResponse(
          JSON.stringify({ error: "Sync token inválido ou expirado" }),
          { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
      // Invalidate the one-time token
      await supabase
        .from("turo_tokens")
        .update({ sync_token: null, sync_token_expires_at: null })
        .eq("id", tokenRowId);
    }
  }

  if (!syncKey && !request.headers.get("X-Sync-Token")) {
    // Fall back to admin JWT auth (for browser-side fetch from our domain)
    const auth = await requireMasterAdmin(request);
    if (!auth.ok) {
      return new NextResponse(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
      );
    }
  }

  const body = await request.json() as {
    upcomingData?: unknown; historyData?: unknown; probe?: unknown;
    earnings?: unknown; reviews?: unknown; feedback?: unknown; payout?: unknown;
    receipts?: { id?: string; data?: RawTrip }[];
  };
  const errors: string[] = [];
  const rows = collectTrips(body.upcomingData, body.historyData);
  const { unlinkedVehicleIds } = await linkTrips(supabase, rows);
  const up = await upsertTrips(supabase, rows);
  const synced = up.synced;
  errors.push(...up.errors);
  const carsUpdated = await fillCarInfoFromTuro(supabase, rows);

  let receiptsSaved = 0;
  if (Array.isArray(body.receipts) && body.receipts.length) {
    const receiptRows = body.receipts
      .filter((r) => r?.id && r.data)
      .map((r) => parseReceipt(String(r.id), r.data as RawTrip));
    const { error: recErr } = await supabase.from("turo_receipts").upsert(receiptRows, { onConflict: "reservation_id" });
    if (recErr) errors.push(`receipts: ${recErr.message}`);
    else receiptsSaved = receiptRows.length;
  }

  // Update last_synced_at on the token row
  const rowId = tokenRowId ?? (await supabase
    .from("turo_tokens")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .then(r => r.data?.id as string | null));

  if (rowId) {
    const update: Record<string, unknown> = { last_synced_at: new Date().toISOString() };
    if (body.probe) update.probe_data = body.probe;
    if (body.earnings !== undefined) update.earnings_data = body.earnings;
    if (body.reviews !== undefined) update.reviews_data = body.reviews;
    if (body.feedback !== undefined) update.feedback_data = body.feedback;
    if (body.payout !== undefined) update.payout_data = body.payout;
    if (body.earnings !== undefined || body.reviews !== undefined || body.feedback !== undefined || body.payout !== undefined) {
      update.host_data_synced_at = new Date().toISOString();
    }
    await supabase.from("turo_tokens").update(update).eq("id", rowId);
  }

  return new NextResponse(
    JSON.stringify({ ok: true, synced, errors, totalFetched: rows.length, receiptsSaved, unlinkedVehicleIds, carsUpdated }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
  );
}
