import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const DescriptionSchema = z.object({
  improvedDescriptionHtml: z.string(),
});

// Conversion (this route) is a distinct concern from discoverability (analyze-discovery) —
// see .claude/skills/ebay-listing-seo/SKILL.md. Description HTML has little direct weight
// on eBay search ranking; its job is turning a buyer who already found the listing into a
// sale, so this prompt optimizes for clarity/presentation, not keyword density.
const SYSTEM_PROMPT = `Você melhora a descrição HTML de um anúncio do eBay para CONVERSÃO — ou seja, para convencer quem já está olhando o anúncio a comprar. Isso é diferente de SEO/busca: não repita palavras-chave à toa, o objetivo aqui é clareza, apresentação visual e confiança.

Regras de conteúdo:
- Preserve as informações reais do produto que já estão na descrição atual — não invente características, ingredientes, tamanhos ou benefícios que não foram mencionados.
- Se descrições de referência forem fornecidas, use-as só como inspiração de ESTRUTURA (como elas organizam informação: visão geral, benefícios, modo de uso, especificações) — nunca copie o texto delas.

Regras de HTML e imagens — o objetivo é um layout que chame atenção, não um bloco de texto corrido:
- Gere HTML válido (tags básicas: div, h2/h3, p, ul/li, strong, img, e estilos inline simples) — sem <script>, sem CSS externo.
- Se URLs de imagens forem fornecidas, use TODAS elas, de forma intencional, não só a primeira: uma imagem de destaque grande no topo (banner/hero, logo abaixo do título principal), e as demais organizadas numa galeria/grade (ex: div com display:flex ou display:grid, gap, cada imagem com border-radius e max-width:100% dentro da célula) ilustrando ângulos, detalhes ou o produto em uso — nunca só uma lista de <img> soltas em sequência vertical.
- Estruture em seções visualmente separadas (ex: um h2/h3 com destaque de cor, um pequeno divisor ou padding entre blocos) — não um único parágrafo. Seções típicas: banner com imagem + título de efeito, "Por que escolher" ou benefícios em lista com ícone/checkmark (✓), "Como usar" se aplicável, especificações em destaque.
- Se não houver nenhuma imagem nova fornecida, mantenha as imagens que já existirem na descrição atual (não as remova), só melhore a estrutura ao redor delas.`;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada. Adicione a chave em .env.local para habilitar a análise com IA." },
      { status: 400 }
    );
  }

  const { currentTitle, currentDescription, imageUrls, referenceDescriptions } = (await request.json()) as {
    currentTitle: string;
    currentDescription: string;
    imageUrls: string[];
    referenceDescriptions?: string[];
  };
  if (!currentTitle || !currentDescription) {
    return NextResponse.json({ error: "currentTitle e currentDescription são obrigatórios" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const userMessage = [
      `Título do produto:\n${currentTitle}`,
      `Descrição atual (HTML):\n${currentDescription}`,
      imageUrls?.length ? `Imagens disponíveis (URLs públicas):\n${imageUrls.join("\n")}` : "Nenhuma imagem nova fornecida — mantenha as referências de imagem que já existirem na descrição atual, se houver.",
      referenceDescriptions?.length
        ? `Estrutura de descrições de referência (só para inspiração de organização, não copiar texto):\n${referenceDescriptions
            .map((d, i) => `--- Referência ${i + 1} ---\n${d}`)
            .join("\n\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(DescriptionSchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json({ error: "A IA não retornou uma descrição válida" }, { status: 502 });
    }

    return NextResponse.json(response.parsed_output);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
