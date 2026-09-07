import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { inspectUrl, searchConsoleErrorStatus } from "@/lib/search-console-api";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const { url } = await request.json();
  if (typeof url !== "string" || !url.trim()) {
    return NextResponse.json({ error: "url é obrigatória" }, { status: 400 });
  }
  try {
    const result = await inspectUrl(url.trim());
    return NextResponse.json({ result });
  } catch (e: unknown) {
    const { status, message } = searchConsoleErrorStatus(e);
    return NextResponse.json({ error: message }, { status });
  }
}
