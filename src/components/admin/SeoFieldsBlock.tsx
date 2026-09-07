"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SettingsField } from "@/components/admin/SettingsField";

export type SeoValues = {
  title: string | null;
  description: string | null;
  og_image: string | null;
  noindex: boolean;
};

type Props = {
  values: SeoValues;
  onChange: <K extends keyof SeoValues>(key: K, value: SeoValues[K]) => void;
  fallbackTitle?: string;
  fallbackDescription?: string;
};

// The four SEO fields (title, description, social image, noindex) reused by the
// per-page and per-product editors. Shows the fallback in the placeholder so the
// admin knows what will be used if a field is left blank.
export function SeoFieldsBlock({ values, onChange, fallbackTitle, fallbackDescription }: Props) {
  return (
    <div className="space-y-5">
      <SettingsField
        label="Título (meta title)"
        value={values.title}
        onChange={(v) => onChange("title", v)}
        placeholder={fallbackTitle || "Deixe em branco para usar o padrão"}
        hint="~50–60 caracteres. É o que aparece na aba do navegador e no título do resultado do Google."
      />
      <SettingsField
        label="Descrição (meta description)"
        value={values.description}
        onChange={(v) => onChange("description", v)}
        placeholder={fallbackDescription || "Deixe em branco para usar o padrão"}
        textarea
        hint="~150–160 caracteres. Aparece como o resumo abaixo do título no Google."
      />
      <SettingsField
        label="Imagem social (Open Graph)"
        value={values.og_image}
        onChange={(v) => onChange("og_image", v)}
        placeholder="https://... (imagem exibida ao compartilhar no WhatsApp/Facebook)"
      />
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
        <div>
          <Label className="font-semibold">Ocultar do Google (noindex)</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ative para pedir aos buscadores que NÃO indexem esta página/produto.
          </p>
        </div>
        <Switch
          checked={values.noindex}
          onCheckedChange={(v) => onChange("noindex", v)}
          className="data-[state=checked]:bg-black"
        />
      </div>
    </div>
  );
}
