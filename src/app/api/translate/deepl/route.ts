import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

function deeplBaseUrl(apiKey: string) {
  return apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPL_API_KEY não configurada. Adicione a chave em .env.local para habilitar a tradução automática." },
      { status: 400 }
    );
  }

  const { title, description, targetLang } = await request.json();
  if (!title || !description || !targetLang) {
    return NextResponse.json({ error: "title, description e targetLang são obrigatórios" }, { status: 400 });
  }

  try {
    const res = await fetch(`${deeplBaseUrl(apiKey)}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [title, description],
        target_lang: targetLang,
        tag_handling: "html",
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      const message = data?.message || `DeepL respondeu ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status === 456 ? 429 : 502 });
    }

    const [translatedTitle, translatedDescription] = data.translations.map((t: { text: string }) => t.text);
    return NextResponse.json({ title: translatedTitle, description: translatedDescription, provider: "deepl" });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
