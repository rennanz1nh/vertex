import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const GeneratedContentSchema = z.object({
  description: z.string(),
  triggers: z.array(z.string()),
  imagePrompts: z.array(z.string()),
  suggestedTitle: z.string(),
});

interface ReferenceProduct {
  name: string;
  brand?: string | null;
  price?: string | number | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY não configurada. Adicione a chave em .env.local para habilitar a geração com IA." },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { name, brand, category, notes, price, similarProducts } = body as {
    name?: string;
    brand?: string;
    category?: string;
    notes?: string;
    price?: string | number;
    similarProducts?: ReferenceProduct[];
  };

  if (!name) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }

  const referencesText = (similarProducts ?? [])
    .slice(0, 10)
    .map((p) => `- ${p.name}${p.brand ? ` (${p.brand})` : ""}${p.price ? ` — $${p.price}` : ""}`)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system:
        "Você é um copywriter de e-commerce especializado em cosméticos, escrevendo para o mercado americano em inglês. " +
        "Recebe as informações brutas de um produto e produtos parecidos que já vendem bem, e devolve: uma descrição de " +
        "produto pronta para colar num anúncio (parágrafos curtos, benefícios primeiro, tom persuasivo mas honesto — sem " +
        "inventar certificações, resultados clínicos ou características que não foram informadas); uma lista de gatilhos " +
        "comerciais específicos para ESTE produto (não genéricos — ex: escassez real se fizer sentido, prova social, " +
        "benefício-chave, urgência, comparação de valor); e prompts de imagem detalhados (cenário, iluminação, ângulo, " +
        "fundo, estilo) prontos para colar em uma IA de geração de imagem, para fotos de still-life do produto.",
      messages: [
        {
          role: "user",
          content:
            `Nome: ${name}\n` +
            `Marca: ${brand ?? "não informado"}\n` +
            `Categoria: ${category ?? "não informado"}\n` +
            `Preço: ${price ?? "não informado"}\n` +
            `Informações/ingredientes/notas fornecidas:\n${notes ?? "(nenhuma)"}\n\n` +
            (referencesText ? `Produtos parecidos que já vendem bem (referência de mercado):\n${referencesText}\n\n` : "") +
            `Gere: descrição do produto, título sugerido, de 4 a 6 gatilhos comerciais e de 3 a 5 prompts de imagem.`,
        },
      ],
      output_config: { format: zodOutputFormat(GeneratedContentSchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json({ error: "A IA não retornou um resultado válido" }, { status: 502 });
    }

    return NextResponse.json(response.parsed_output);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
