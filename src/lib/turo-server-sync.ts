// Server-side pull of the Turo host feeds using the stored cookies. This is a best-effort
// path: Turo sits behind Cloudflare, which has been rejecting requests that originate from
// cloud/serverless IPs (403 HTML challenge) even with valid cookies. Every attempt records its
// outcome on turo_tokens so the UI can say plainly whether automatic updates are working.
import type { SupabaseClient } from "@supabase/supabase-js";
import { collectTrips, linkTrips, upsertTrips, fillCarInfoFromTuro } from "@/lib/turo-trips";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export type ServerSyncResult = {
  ok: boolean;
  message: string;
  synced?: number;
  totalFetched?: number;
  unlinkedVehicleIds?: string[];
  carsUpdated?: number;
  tokenRefreshed?: boolean;
};

function accessTokenOf(stored: string): string {
  const m = stored.match(/access_token=([^;]+)/);
  return (m ? m[1] : stored).trim();
}

function isExpiredOrSoon(accessToken: string, marginSeconds = 300): boolean {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    const exp = Number(payload.exp ?? 0);
    return exp === 0 || Date.now() / 1000 > exp - marginSeconds;
  } catch {
    return true;
  }
}

function replaceCookie(cookie: string, name: string, value: string): string {
  const re = new RegExp(`(^|;\\s*)${name}=[^;]*`);
  return re.test(cookie) ? cookie.replace(re, `$1${name}=${value}`) : `${cookie}; ${name}=${value}`;
}

async function refreshCookies(stored: string): Promise<string | null> {
  const rt = stored.match(/refresh_token=([^;]+)/)?.[1]?.trim();
  if (!rt) return null;
  const res = await fetch("https://turo.com/api/v2/token", {
    method: "POST",
    headers: {
      Cookie: stored,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      Referer: "https://turo.com/us/en/host",
      Origin: "https://turo.com",
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(rt)}&client_id=web`,
    signal: AbortSignal.timeout(20000),
  });
  // The endpoint answers with an HTML body but sets the renewed cookies on the response.
  const setCookies: string[] = (res.headers as { getSetCookie?: () => string[] }).getSetCookie?.()
    ?? res.headers.get("set-cookie")?.split(/,\s*(?=[a-zA-Z_-]+=)/) ?? [];
  let updated = stored;
  for (const sc of setCookies) {
    const m = sc.match(/^([^=]+)=([^;]*)/);
    if (m && ["access_token", "refresh_token", "__cf_bm", "JSESSIONID"].includes(m[1]) && m[2]) {
      updated = replaceCookie(updated, m[1], m[2]);
    }
  }
  const fresh = accessTokenOf(updated);
  return fresh && !isExpiredOrSoon(fresh, 60) ? updated : null;
}

function feedHeaders(stored: string) {
  return {
    Cookie: stored.includes("access_token=") ? stored : `access_token=${stored}`,
    Authorization: `Bearer ${accessTokenOf(stored)}`,
    Accept: "application/json",
    "User-Agent": UA,
    "Accept-Language": "en-US,en;q=0.9",
    "turo-country": "US",
    Referer: "https://turo.com/us/en/host",
    Origin: "https://turo.com",
  };
}

type FeedResult = { ok: true; data: unknown } | { ok: false; status: number; blocked: boolean };

async function getFeed(url: string, stored: string): Promise<FeedResult> {
  const res = await fetch(url, { headers: feedHeaders(stored), signal: AbortSignal.timeout(25000) });
  if (res.ok) return { ok: true, data: await res.json() };
  const body = await res.text();
  return { ok: false, status: res.status, blocked: res.status === 403 && /<html/i.test(body) };
}

async function record(supabase: SupabaseClient, ok: boolean, message: string) {
  await supabase
    .from("turo_tokens")
    .update({ auto_sync_at: new Date().toISOString(), auto_sync_ok: ok, auto_sync_message: message.slice(0, 300) })
    .neq("id", "00000000-0000-0000-0000-000000000000");
}

export async function runServerSync(supabase: SupabaseClient): Promise<ServerSyncResult> {
  const finish = async (r: ServerSyncResult) => { await record(supabase, r.ok, r.message); return r; };

  const { data: rows } = await supabase.from("turo_tokens").select("id, bearer_token");
  const candidates = (rows ?? []) as { id: string; bearer_token: string }[];
  if (!candidates.length) return finish({ ok: false, message: "Turo não está conectado." });
  // Prefer the stored cookie that carries a refresh_token (the fuller one)
  const row = candidates.find((r) => r.bearer_token.includes("refresh_token=")) ?? candidates[0];

  let stored = row.bearer_token;
  let tokenRefreshed = false;
  if (isExpiredOrSoon(accessTokenOf(stored))) {
    try {
      const renewed = await refreshCookies(stored);
      if (!renewed) return finish({ ok: false, message: "Token expirado e a renovação falhou. Cole os cookies de novo em Sincronização." });
      stored = renewed;
      tokenRefreshed = true;
      await supabase.from("turo_tokens").update({ bearer_token: stored, updated_at: new Date().toISOString() }).eq("id", row.id);
    } catch (e) {
      return finish({ ok: false, message: `Renovação do token falhou: ${(e as Error).message}` });
    }
  }

  let upcoming: FeedResult;
  let history: FeedResult;
  try {
    upcoming = await getFeed("https://turo.com/api/v2/feeds/upcoming-trips?appMode=HOST", stored);
    history = await getFeed("https://turo.com/api/v2/feeds/trip-history?driverRoles=HOST", stored);
  } catch (e) {
    return finish({ ok: false, tokenRefreshed, message: `Falha de rede ao falar com a Turo: ${(e as Error).message}` });
  }

  if (!upcoming.ok || !history.ok) {
    const bad = (upcoming.ok ? history : upcoming) as Extract<FeedResult, { ok: false }>;
    const message = bad.blocked
      ? "A Turo (Cloudflare) bloqueou o acesso a partir do servidor (403). Use o sync manual."
      : `A Turo respondeu com erro ${bad.status}.`;
    return finish({ ok: false, tokenRefreshed, message });
  }

  const trips = collectTrips(upcoming.data, history.data);
  const { unlinkedVehicleIds } = await linkTrips(supabase, trips);
  const up = await upsertTrips(supabase, trips);
  const carsUpdated = await fillCarInfoFromTuro(supabase, trips);
  await supabase.from("turo_tokens").update({ last_synced_at: new Date().toISOString() }).eq("id", row.id);

  const message = up.errors.length
    ? `${up.synced} viagens atualizadas, ${up.errors.length} com erro.`
    : `${up.synced} viagens atualizadas automaticamente.`;
  return finish({ ok: up.errors.length === 0, message, synced: up.synced, totalFetched: trips.length, unlinkedVehicleIds, carsUpdated, tokenRefreshed });
}
