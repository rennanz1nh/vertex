"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Check } from "lucide-react";

interface Draft {
  name: string;
  brand: string | null;
  ai_description: string | null;
  ai_triggers: string[];
  price: number | string | null;
  images: string[];
}

// There's no Amazon listing-creation call in this app yet — Amazon's SP-API requires a
// recognized product identifier (UPC/EAN) or category approval before a new listing goes
// through, which is a bigger, separate integration. Until that exists, this just formats
// the AI-written content into the shape Seller Central's "Add a product" form expects, so
// pasting it in is quick instead of writing it all by hand.
export function AmazonPrepareDialog({ draft, open, onOpenChange }: { draft: Draft; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [copied, setCopied] = useState(false);

  const text = [
    `Nome do produto: ${draft.name}`,
    draft.brand ? `Marca: ${draft.brand}` : null,
    draft.price ? `Preço sugerido: $${Number(draft.price).toFixed(2)}` : null,
    "",
    "Descrição:",
    draft.ai_description ?? "(gere a descrição com IA antes de publicar)",
    "",
    "Bullet points (gatilhos comerciais):",
    ...draft.ai_triggers.map((t) => `• ${t}`),
    "",
    `Imagens (${draft.images.length}):`,
    ...draft.images,
  ]
    .filter((line) => line !== null)
    .join("\n");

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Preparar para Amazon</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Publicação automática na Amazon ainda não está disponível — a API deles exige um identificador de produto
          (UPC/EAN) ou aprovação de categoria antes de aceitar um anúncio novo. Por enquanto, copie o texto abaixo e
          cole em "Adicionar um produto" no Seller Central.
        </p>
        <Textarea value={text} readOnly rows={14} className="font-mono text-xs" />
        <Button onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
          {copied ? "Copiado!" : "Copiar tudo"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
