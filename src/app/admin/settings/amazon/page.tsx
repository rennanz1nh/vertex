"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, Link2, Percent, CircleDot } from "lucide-react";
import { SettingsHeader } from "@/components/admin/SettingsHeader";

const amazonLogo = "/images/sales-channels/Amazon.png";

/** Field-by-field record of how the Seller Central report maps into our orders — kept in
 *  the product itself (rather than a doc nobody opens) so whoever runs the next import can
 *  check what a given column becomes without reading the parser. */
const FIELD_MAP: Array<{ amazon: string; nosso: string; obs?: string }> = [
  { amazon: "amazon-order-id", nosso: "Nº Pedido", obs: "Chave anti-duplicata" },
  { amazon: "purchase-date", nosso: "Data", obs: "Só a data, sem horário" },
  { amazon: "item-status", nosso: "Status (bolinhas)", obs: "Shipped = verde · Unshipped = amarelo" },
  { amazon: "order-status", nosso: "Status", obs: "Só usado para detectar Cancelado (vermelho)" },
  { amazon: "sales-channel", nosso: "Canal de Venda", obs: "Fixo: Amazon" },
  { amazon: "asin", nosso: "Vínculo do produto + ASIN no item", obs: "Chave do produto" },
  { amazon: "quantity", nosso: "Qtd. Produtos" },
  { amazon: "item-price", nosso: "Valor Vendido Unit. ($)", obs: "Dividido pela quantidade" },
  { amazon: "item-tax + shipping-tax", nosso: "TAX (U$)" },
  { amazon: "shipping-price", nosso: "Shipping Pago Cliente" },
  { amazon: "item-promotion-discount", nosso: "Desconto (U$)" },
  { amazon: "ship-city + ship-state + ship-postal-code + ship-country", nosso: "Endereço do pedido", obs: "Nessa ordem, separados por vírgula" },
];

const DISCARDED = [
  "source_file", "merchant-order-id", "last-updated-date", "order-channel", "ship-service-level",
  "gift-wrap-price", "gift-wrap-tax", "ship-promotion-discount", "promotion-ids", "is-business-order",
  "price-designation", "signature-confirmation-recommended", "buyer-identification-number",
  "buyer-identification-type", "product-name", "sku", "url", "currency", "fulfillment-channel",
];

export default function AmazonSettingsPage() {
  return (
    <div className="space-y-6">
      <SettingsHeader />

      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={amazonLogo} alt="Amazon" className="h-8 w-auto object-contain" />
          <h2 className="text-2xl font-bold tracking-tight">Amazon</h2>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            A Amazon só libera a API (SP-API) para contas no plano <strong>Profissional</strong>. Como
            esta conta é <strong>Individual</strong>, os pedidos entram pela importação do relatório do
            Seller Central — botão <strong>&quot;Pedidos Upload&quot;</strong> na página de Pedidos.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" /> Vínculo dos Produtos
            </CardTitle>
            <CardDescription>
              A Amazon identifica produtos por <strong>ASIN</strong>. O SKU que ela reporta é um código
              interno dela (ex: <code className="text-xs">RX-9OAO-GC7D</code>) e não tem relação com o
              nosso catálogo — por isso o vínculo é feito só pelo ASIN.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              O ASIN fica no <strong>cadastro do produto</strong> (Produtos → editar → campo ASIN). Se um
              ASIN não estiver cadastrado em nenhum produto, o pedido ainda é importado, mas o item fica
              sem produto vinculado — e a tela de importação avisa quais ASINs faltam.
            </p>
            <p className="text-muted-foreground text-xs">
              Um mesmo produto físico pode ter mais de um ASIN (anúncios diferentes, embalagem antiga vs.
              nova). Nesse caso, cadastre um produto por ASIN para o histórico ficar separado.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" /> Comissão da Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>
              Todo pedido importado com canal <strong>Amazon</strong> recebe automaticamente{" "}
              <strong>15% sobre o valor dos produtos</strong> no campo{" "}
              <strong>&quot;Comissão Venda (Plataforma)&quot;</strong>.
            </p>
            <p className="text-muted-foreground text-xs">
              O cálculo usa só o subtotal dos produtos — frete e imposto ficam de fora, que é como a
              Amazon cobra a taxa de indicação. Pedidos cancelados recebem comissão zero.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleDot className="h-5 w-5" /> Mapeamento dos Campos
            </CardTitle>
            <CardDescription>Como cada coluna do relatório vira dado no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2.5 font-medium">Coluna na Amazon</th>
                    <th className="text-left p-2.5 font-medium">Vira no nosso sistema</th>
                    <th className="text-left p-2.5 font-medium">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELD_MAP.map((f) => (
                    <tr key={f.amazon} className="border-t align-top">
                      <td className="p-2.5 font-mono text-xs break-all">{f.amazon}</td>
                      <td className="p-2.5">{f.nosso}</td>
                      <td className="p-2.5 text-xs text-muted-foreground">{f.obs ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Colunas Descartadas</CardTitle>
            <CardDescription>Ignoradas na importação por não terem uso no sistema</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {DISCARDED.map((c) => (
              <Badge key={c} variant="outline" className="font-mono text-[10px] text-muted-foreground">
                {c}
              </Badge>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campos que ficam em branco</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>O relatório de pedidos não traz estes dados — precisam ser preenchidos à mão ou virão de outro relatório:</p>
            <ul className="list-disc list-inside text-xs space-y-0.5 pt-1">
              <li><strong>Cliente</strong> — a Amazon não identifica o comprador nesse relatório</li>
              <li><strong>Shipping Tracking</strong> e <strong>Carrier</strong></li>
              <li><strong>Valor pago pelo envio</strong> (nosso custo real de frete)</li>
              <li><strong>Valor de Custo</strong> dos produtos</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
