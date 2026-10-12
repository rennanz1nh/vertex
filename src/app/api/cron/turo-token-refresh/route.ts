// Cron job: refreshes the stored Turo access_token using the refresh_token (valid 1 year).
// Runs every 6 hours via Vercel Cron so the token never expires between syncs.
// The refresh endpoint returns 404 HTML but sets Set-Cookie with a new access_token.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractAccessToken } from "@/app/api/admin/turo/config/route";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
  );
}

function replaceCookieValue(cookieStr: string, name: string, newValue: string): string {
  const regex = new RegExp(`(^|;\\s*)${name}=[^;]*`);
  if (regex.test(cookieStr)) {
    return cookieStr.replace(new RegExp(`(^|;\\s*)${name}=[^;]*`), `$1${name}=${newValue}`);
  }
  return `${cookieStr}; ${name}=${newValue}`;
}

function isTokenExpiredOrSoon(accessToken: string, marginSeconds = 300): boolean {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString());
    const exp = Number(payload.exp ?? 0);
    return exp === 0 || Date.now() / 1000 > exp - marginSeconds;
  } catch {
    return true;
  }
}

export async function GET(request: NextRequest) {
  // Vercel cron auth
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET ?? ""}` && process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: tokenRow, error } = await supabase
    .from("turo_tokens")
    .select("id, bearer_token")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !tokenRow) {
    return NextResponse.json({ ok: false, reason: "no token row" });
  }

  const stored: string = tokenRow.bearer_token;
  const currentAccess = extractAccessToken(stored);

  // Only refresh if expiring within 3 hours (10800s)
  if (!isTokenExpiredOrSoon(currentAccess, 10800)) {
    return NextResponse.json({ ok: true, reason: "token still fresh, skipped" });
  }

  const refreshMatch = stored.match(/refresh_token=([^;]+)/);
  if (!refreshMatch) {
    return NextResponse.json({ ok: false, reason: "no refresh_token in stored cookie" });
  }
  const refreshToken = refreshMatch[1].trim();

  const res = await fetch("https://turo.com/api/v2/token", {
    method: "POST",
    headers: {
      Cookie: stored,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      Referer: "https://turo.com/us/en/host",
      Origin: "https://turo.com",
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=web`,
  });

  const setCookies: string[] = (res.headers as { getSetCookie?: () => string[] }).getSetCookie?.()
    ?? res.headers.get("set-cookie")?.split(/,\s*(?=[a-zA-Z_-]+=)/) ?? [];

  let updated = stored;
  let refreshed = false;
  for (const sc of setCookies) {
    const m = sc.match(/^([^=]+)=([^;]*)/);
    if (!m) continue;
    const [, name, value] = m;
    if (["access_token", "refresh_token", "__cf_bm", "JSESSIONID"].includes(name) && value) {
      updated = replaceCookieValue(updated, name, value);
      if (name === "access_token") refreshed = true;
    }
  }

  if (!refreshed) {
    return NextResponse.json({ ok: false, reason: `refresh endpoint returned ${res.status}, no new access_token in Set-Cookie` });
  }

  await supabase
    .from("turo_tokens")
    .update({ bearer_token: updated, updated_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  return NextResponse.json({ ok: true, reason: "token refreshed" });
}
