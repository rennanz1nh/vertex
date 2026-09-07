import { NextRequest, NextResponse } from "next/server";
import { getProjectIamPolicy } from "@/lib/google-iam";
import { requireAdmin } from "@/lib/admin-auth";

// Who has access to the GCP project is real reconnaissance value for an attacker
// (targets the highest-privilege account for phishing) — checked server-side unlike
// most admin routes in this project (see admin-auth.ts's own doc comment).
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Não autorizado" }, { status: auth.status });

  try {
    const bindings = await getProjectIamPolicy();
    return NextResponse.json({ bindings });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
