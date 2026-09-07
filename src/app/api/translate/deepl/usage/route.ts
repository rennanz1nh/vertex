import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

function deeplBaseUrl(apiKey: string) {
  return apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "DEEPL_API_KEY não configurada" }, { status: 400 });
  }

  try {
    const res = await fetch(`${deeplBaseUrl(apiKey)}/v2/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.message || `DeepL respondeu ${res.status}` }, { status: 502 });
    }

    return NextResponse.json({
      characterCount: data.character_count,
      characterLimit: data.character_limit,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
