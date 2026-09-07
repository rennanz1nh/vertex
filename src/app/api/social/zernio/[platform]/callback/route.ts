import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listZernioAccounts, type ZernioPlatform } from "@/lib/social-media/zernio-client";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

const VALID_PLATFORMS: ZernioPlatform[] = ["instagram", "tiktok"];
function isValidPlatform(value: string): value is ZernioPlatform {
  return (VALID_PLATFORMS as string[]).includes(value);
}

function safeReturnTo(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/admin/social-media/hub-zernio";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const joiner = returnTo.includes("?") ? "&" : "?";
  const redirectTo = (query: string) => NextResponse.redirect(new URL(`${returnTo}${joiner}${query}`, request.url));

  if (!isValidPlatform(platform)) return redirectTo("social_error=Plataforma%20desconhecida");

  // Zernio's own error signal on the way back, if any — exact param name unconfirmed
  // (couldn't reach their docs directly), so this checks the common conventions rather
  // than assume a specific one.
  const errorParam = request.nextUrl.searchParams.get("error") ?? request.nextUrl.searchParams.get("error_message");
  if (errorParam) return redirectTo(`social_error=${encodeURIComponent(errorParam)}&social_platform=${platform}`);

  try {
    // Deliberately don't trust whatever Zernio put in the redirect query string for the
    // connected account's identity — that shape isn't confirmed either. Ask Zernio
    // directly which account is connected for this profile+platform instead.
    const accounts = await listZernioAccounts(platform);
    const account = accounts[0];
    if (!account) {
      return redirectTo(`social_error=${encodeURIComponent("Zernio não retornou nenhuma conta conectada — tente novamente")}&social_platform=${platform}`);
    }

    const supabase = getSupabase();
    const { error: upsertError } = await supabase.from("zernio_social_accounts").upsert(
      {
        platform,
        zernio_account_id: account.accountId,
        account_name: account.accountName,
        avatar_url: account.avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform" }
    );
    if (upsertError) return redirectTo(`social_error=${encodeURIComponent(upsertError.message)}&social_platform=${platform}`);

    return redirectTo(`social_connected=${platform}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return redirectTo(`social_error=${encodeURIComponent(msg)}&social_platform=${platform}`);
  }
}
