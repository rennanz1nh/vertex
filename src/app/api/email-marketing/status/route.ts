import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAccount, getSenders } from "@/lib/brevo";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  if (!process.env.BREVO_API_KEY) {
    return NextResponse.json({ connected: false, reason: "missing_api_key" });
  }

  try {
    const [account, senders] = await Promise.all([getAccount(), getSenders()]);
    return NextResponse.json({
      connected: true,
      companyName: account?.companyName ?? null,
      email: account?.email ?? null,
      plan: account?.plan ?? [],
      senders: senders?.senders ?? [],
      configuredSender: process.env.BREVO_SENDER_EMAIL ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ connected: false, reason: "api_error", error: err?.message ?? "Unknown error" });
  }
}
