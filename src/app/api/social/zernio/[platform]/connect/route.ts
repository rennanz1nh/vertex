import { NextRequest, NextResponse } from "next/server";
import { getZernioConnectUrl, zernioConfigured, type ZernioPlatform } from "@/lib/social-media/zernio-client";

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
  if (!isValidPlatform(platform)) {
    return NextResponse.json({ error: "Plataforma desconhecida" }, { status: 400 });
  }
  if (!zernioConfigured()) {
    return NextResponse.json(
      { error: "ZERNIO_API_KEY / ZERNIO_PROFILE_ID não configurados — crie uma conta em zernio.com e configure essas variáveis antes de conectar." },
      { status: 500 }
    );
  }

  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vertexrentalcars.com";
  const redirectUrl = `${appUrl}/api/social/zernio/${platform}/callback?returnTo=${encodeURIComponent(returnTo)}`;

  const result = await getZernioConnectUrl(platform, redirectUrl);
  if ("error" in result) {
    const joiner = returnTo.includes("?") ? "&" : "?";
    return NextResponse.redirect(new URL(`${returnTo}${joiner}social_error=${encodeURIComponent(result.error)}&social_platform=${platform}`, request.url));
  }
  return NextResponse.redirect(result.authUrl);
}
