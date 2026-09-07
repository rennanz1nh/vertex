"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, Copy, Check, AlertCircle, CheckCircle2 } from "lucide-react";
import { MetaLogo } from "@/components/brand-logos";
import { FacebookPixelAutomationTabs } from "@/components/facebook/FacebookPixelAutomationTabs";
import { useSiteSettings } from "@/hooks/useSiteSettings";

type PixelEvent = {
  name: string;
  description: string;
  status: "active" | "inactive" | "pending";
};

const PIXEL_EVENTS: PixelEvent[] = [
  { name: "PageView", description: "Rastreamento automático de visualização de página", status: "active" },
  { name: "ViewContent", description: "Quando um produto é visualizado", status: "active" },
  { name: "AddToCart", description: "Quando um item é adicionado ao carrinho", status: "active" },
  { name: "InitiateCheckout", description: "Quando o cliente começa o checkout", status: "active" },
  { name: "Purchase", description: "Quando uma compra é completada", status: "active" },
  { name: "Search", description: "Quando o cliente faz uma busca", status: "active" },
];

export default function FacebookPixelPage() {
  const { row: settings, loading } = useSiteSettings();
  const [showPixelId, setShowPixelId] = useState(false);
  const [copied, setCopied] = useState(false);

  const pixelId = settings?.facebook_pixel_id || "";
  const isConfigured = !!pixelId;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FacebookPixelAutomationTabs />

      <div className="max-w-4xl space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b">
          <MetaLogo className="h-12 w-12" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meta Pixel</h1>
            <p className="text-sm text-muted-foreground">Facebook & Instagram Conversion Tracking</p>
          </div>
        </div>

        {!isConfigured && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhum Pixel ID configurado. Vá para <strong>Admin &gt; Configurações &gt; Facebook</strong> para configurar.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
            <CardContent>
              {isConfigured ? (
                <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <AlertCircle className="h-3 w-3" />
                  Inativo
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Ambiente</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary">Apenas em Produção</Badge>
              <p className="text-xs text-muted-foreground mt-2">O Pixel não é injetado em desenvolvimento local.</p>
            </CardContent>
          </Card>
        </div>

        {isConfigured && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MetaLogo className="h-5 w-5" />
                Pixel ID
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted p-3 rounded-lg flex items-center justify-between font-mono text-sm">
                {showPixelId ? pixelId : "•".repeat(pixelId.length)}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPixelId(!showPixelId)}
                  >
                    {showPixelId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(pixelId)}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Use este ID quando integrar manualmente ou em ferramentas de terceiros.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Eventos Rastreados</CardTitle>
            <CardDescription>
              Estado de implementação dos eventos do Facebook Pixel. Eventos marcados como "Pendente" precisam ser implementados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PIXEL_EVENTS.map((event, i) => (
              <div key={i} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex-1">
                  <p className="font-medium text-sm">{event.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
                </div>
                <Badge
                  variant={
                    event.status === "active"
                      ? "default"
                      : event.status === "pending"
                        ? "secondary"
                        : "outline"
                  }
                  className={
                    event.status === "active"
                      ? "bg-green-100 text-green-700 border-green-300"
                      : event.status === "pending"
                        ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                        : ""
                  }
                >
                  {event.status === "active" && "Ativo"}
                  {event.status === "inactive" && "Inativo"}
                  {event.status === "pending" && "Pendente"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verificação de Domínio</CardTitle>
            <CardDescription>
              Verificação de domínio configurada nos serviços Meta (Facebook/Instagram).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {settings?.facebook_domain_verification ? (
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Verificação configurada
                </p>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                <p className="text-sm text-yellow-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Verificação não configurada
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Configure em Admin &gt; Configurações &gt; Facebook para melhor segurança.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feed de Produtos</CardTitle>
            <CardDescription>
              URL do feed de produtos para o Commerce Manager do Meta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted p-3 rounded-lg font-mono text-xs break-all">
              {typeof window !== "undefined"
                ? `${window.location.origin}/feed/products`
                : "/feed/products"}
            </div>
            <p className="text-xs text-muted-foreground">
              Use esta URL no Meta Commerce Manager para sincronizar seu catálogo de produtos automaticamente.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documentação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              • Para mais informações sobre Facebook Pixel, acesse{" "}
              <a href="https://www.facebook.com/business/tools/facebook-pixel" target="_blank" className="text-blue-600 hover:underline">
                Facebook Pixel Documentation
              </a>
            </p>
            <p>
              • Configure eventos adicionais em{" "}
              <a href="https://business.facebook.com/events_manager" target="_blank" className="text-blue-600 hover:underline">
                Events Manager
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
