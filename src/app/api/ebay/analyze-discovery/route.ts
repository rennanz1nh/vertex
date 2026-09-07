import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const DiscoverySchema = z.object({
  suggestedTitle: z.string(),
  titleKeywordGaps: z.array(z.string()),
  specificsSuggestions: z.array(
    z.object({
      name: z.string(),
      suggestedValue: z.string(),
      reason: z.string(),
    })
  ),
});

type ListingRef = {
  title: string;
  itemSpecifics: { name: string; values: string[] }[];
};

// Discoverability (title + item specifics) is a distinct concern from conversion
// (description/photos) — see .claude/skills/ebay-listing-seo/SKILL.md. This route only
// touches the two fields that actually affect whether Cassini surfaces the listing at all.
const SYSTEM_PROMPT = `Você ajuda um vendedor a melhorar a DESCOBERTA de um anúncio do eBay — a chance dele ser encontrado na busca (algoritmo Cassini), não a de converter quem já o achou.

Como o Cassini usa cada campo:
- TÍTULO: comparado contra o que o comprador digita antes de qualquer outra coisa. Limite de 80 caracteres — use de 70 a 80. As primeiras 5-7 palavras pesam mais que o resto. Se uma palavra buscada não está no título, o anúncio nem entra na disputa.
- ESPECIFICAÇÕES DO ITEM (item specifics): usadas tanto pelos filtros de busca (se o campo está vazio, o anúncio não aparece pra quem filtra por ele) quanto pela relevância geral — anúncios com especificações incompletas recebem menos visibilidade mesmo fora de busca filtrada.

Você vai receber o anúncio atual do vendedor e alguns anúncios de referência de produtos parecidos que vendem bem. Use as referências SÓ para descobrir quais campos e palavras importam nessa categoria — nunca copie um valor literal de um concorrente (ex: nunca sugira a marca ou o SKU de um concorrente para o nosso produto). Todo valor sugerido tem que vir do que já sabemos do nosso próprio produto (o título e as especificações atuais dele). Se não for possível inferir um valor confiável para o nosso produto a partir do que já temos, não sugira esse campo — é melhor deixar de fora do que inventar.

Título sugerido: até 80 caracteres, com as palavras mais buscáveis nas primeiras posições, mantendo marca e produto reconhecíveis.`;

function formatListing(label: string, listing: ListingRef): string {
  const specifics = listing.itemSpecifics.map((s) => `  - ${s.name}: ${s.values.join(", ")}`).join("\n") || "  (nenhuma)";
  return `${label}\nTítulo: ${listing.title}\nEspecificações:\n${specifics}`;
}

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

  const { current, references } = (await request.json()) as { current: ListingRef; references: ListingRef[] };
  if (!current?.title || !references?.length) {
    return NextResponse.json({ error: "current e references (pelo menos 1) são obrigatórios" }, { status: 400 });
  }

  try {
    const client = new Anthropic({ apiKey });
    const userMessage = [
      formatListing("=== NOSSO ANÚNCIO ===", current),
      ...references.map((r, i) => formatListing(`=== REFERÊNCIA ${i + 1} ===`, r)),
    ].join("\n\n");

    const response = await client.messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
      output_config: { format: zodOutputFormat(DiscoverySchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json({ error: "A IA não retornou uma análise válida" }, { status: 502 });
    }

    return NextResponse.json(response.parsed_output);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
