import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

export interface GoogleResult {
  title: string;
  link: string;
  snippet: string;
  thumbnailUrl: string | null;
}

// Google Custom Search JSON API — needs a Programmable Search Engine (any CSE configured
// to search the whole web) plus an API key from Google Cloud Console. Both are separate
// from anything else already configured in this project.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const q = request.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "q é obrigatório" }, { status: 400 });

  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !cx) {
    return NextResponse.json(
      { error: "Busca no Google não configurada (GOOGLE_CSE_API_KEY / GOOGLE_CSE_ID ausentes)." },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?${new URLSearchParams({
        key: apiKey,
        cx,
        q,
        num: "10",
      })}`
    );
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message ?? "Falha na busca do Google" }, { status: 502 });
    }

    const results: GoogleResult[] = (data.items ?? []).map((i: any) => ({
      title: i.title,
      link: i.link,
      snippet: i.snippet,
      thumbnailUrl: i.pagemap?.cse_thumbnail?.[0]?.src ?? i.pagemap?.cse_image?.[0]?.src ?? null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
