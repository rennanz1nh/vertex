import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const TranslationSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada. Adicione a chave em .env.local para habilitar a tradução com IA." },
      { status: 400 }
    );
  }

  const { title, description, targetLanguageName } = await request.json();
  if (!title || !description || !targetLanguageName) {
    return NextResponse.json({ error: "title, description e targetLanguageName são obrigatórios" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system:
        "Você traduz anúncios de e-commerce (título e descrição em HTML) preservando o tom de venda e o apelo comercial — não é uma tradução literal palavra por palavra. Mantenha toda a formatação e as tags HTML da descrição intactas, traduzindo apenas o texto visível dentro delas.",
      messages: [
        {
          role: "user",
          content: `Traduza o título e a descrição de um anúncio de e-commerce para ${targetLanguageName}, mantendo o tom de marketing.\n\nTítulo:\n${title}\n\nDescrição (HTML):\n${description}`,
        },
      ],
      output_config: { format: zodOutputFormat(TranslationSchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json({ error: "A IA não retornou uma tradução válida" }, { status: 502 });
    }

    return NextResponse.json({
      title: response.parsed_output.title,
      description: response.parsed_output.description,
      provider: "claude",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
