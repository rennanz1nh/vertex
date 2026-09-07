import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createClient } from "@supabase/supabase-js";
import { getServiceAccountEmail, getProjectId } from "@/lib/google-cloud-auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  let serviceAccountEmail: string | null = null;
  let projectId: string | null = null;
  try {
    serviceAccountEmail = getServiceAccountEmail();
    projectId = getProjectId();
  } catch {
    // Falls through — UI shows the "not configured" state.
  }

  const supabase = getSupabase();
  const [merchant, searchConsole] = await Promise.all([
    supabase.from("google_shopping_tokens").select("merchant_id, updated_at").eq("environment", "production").single(),
    supabase.from("search_console_settings").select("site_url, updated_at").eq("environment", "production").single(),
  ]);

  return NextResponse.json({
    serviceAccountEmail,
    projectId,
    apis: [
      {
        key: "merchant",
        name: "Merchant API (Google Shopping)",
        connected: !merchant.error && !!merchant.data,
        detail: merchant.data?.merchant_id ? `Merchant ID: ${merchant.data.merchant_id}` : null,
      },
      {
        key: "search-console",
        name: "Search Console API",
        connected: !searchConsole.error && !!searchConsole.data?.site_url,
        detail: searchConsole.data?.site_url ?? null,
      },
    ],
  });
}
