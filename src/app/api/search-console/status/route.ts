import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getServiceAccountEmail, getSiteUrl } from "@/lib/search-console-auth";
import { getSiteInfo } from "@/lib/search-console-api";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  let serviceAccountEmail: string | null = null;
  try {
    serviceAccountEmail = getServiceAccountEmail();
  } catch {
    // Service account not configured at all — fall through, UI shows the setup instructions.
  }

  const siteUrl = await getSiteUrl();

  if (!serviceAccountEmail) {
    return NextResponse.json({
      connected: false,
      serviceAccountEmail: null,
      siteUrl,
      error: "GOOGLE_SHOPPING_SERVICE_ACCOUNT_JSON não configurado no servidor.",
    });
  }

  try {
    const site = await getSiteInfo();
    const verified = site.permissionLevel !== "siteUnverifiedUser";
    return NextResponse.json({
      connected: verified,
      serviceAccountEmail,
      siteUrl,
      permissionLevel: site.permissionLevel,
      error: verified
        ? null
        : `A conta de serviço ainda não foi adicionada como usuária em Search Console (nível atual: ${site.permissionLevel}).`,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ connected: false, serviceAccountEmail, siteUrl, error: message });
  }
}
