import { NextRequest, NextResponse } from "next/server";
import { PLATFORM_CONFIG, isValidPlatform, redirectUriFor } from "@/lib/social-platforms";

/** Only a same-origin relative path is accepted as a return target, mirroring the eBay
 *  OAuth flow's safeReturnTo — never lets `returnTo` become an open redirect. */
function safeReturnTo(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/admin/social-media/hub";
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: "Plataforma desconhecida" }, { status: 400 });
  }

  const config = PLATFORM_CONFIG[platform];
  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    return NextResponse.json(
      { error: `${config.clientIdEnv} não configurado — cadastre um app de desenvolvedor para ${config.label} antes de conectar.` },
      { status: 500 }
    );
  }

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const state = Buffer.from(JSON.stringify({ returnTo })).toString("base64url");
  const url = config.authUrl({ clientId, redirectUri: redirectUriFor(platform), state });

  return NextResponse.redirect(url);
}
