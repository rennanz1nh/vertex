import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getAggregatedStats, getContactsCount, getLists } from "@/lib/brevo";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  try {
    const [stats, contacts, lists] = await Promise.all([
      getAggregatedStats(),
      getContactsCount(),
      getLists({ limit: 50 }),
    ]);

    return NextResponse.json({
      stats,
      totalContacts: contacts?.count ?? 0,
      totalLists: lists?.count ?? (lists?.lists?.length ?? 0),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to fetch stats" }, { status: 500 });
  }
}
