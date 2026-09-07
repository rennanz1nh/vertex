"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, Search, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { GoogleShoppingAutomationTabs } from "@/components/google-shopping/GoogleShoppingAutomationTabs";
import { useToast } from "@/hooks/use-toast";
import { authedFetch } from "@/lib/admin-fetch";

type ProductStatus = {
  id: string;
  sku: string;
  title: string;
  imageUrl?: string;
  price: number;
  status: "approved" | "under_review" | "disapproved" | "not_synced";
  issues?: Array<{ code: string; description: string }>;
  lastSynced?: string;
};

export default function GoogleShoppingProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await authedFetch("/api/google-shopping/products");
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        setProducts([]);
      } else if (data.statusesError) {
        toast({
          title: "Aviso",
          description: "Produtos sincronizados mas status ainda não disponível do Google",
          variant: "default",
        });
        setProducts(data.products || []);
      } else {
        setProducts(data.products || []);
        toast({ title: "Atualizado!", description: `${data.products?.length || 0} produtos carregados.` });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: "Erro ao carregar", description: msg, variant: "destructive" });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filtered = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    approved: products.filter((p) => p.status === "approved").length,
    under_review: products.filter((p) => p.status === "under_review").length,
    disapproved: products.filter((p) => p.status === "disapproved").length,
    not_synced: products.filter((p) => p.status === "not_synced").length,
  };

  const getStatusBadge = (status: ProductStatus["status"]) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-700 border-green-300 gap-1"><CheckCircle2 className="h-3 w-3" />Aprovado</Badge>;
      case "under_review":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-300 gap-1"><Clock className="h-3 w-3" />Em análise</Badge>;
      case "disapproved":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Reprovado</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 text-muted-foreground"><AlertTriangle className="h-3 w-3" />Não sincronizado</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <GoogleShoppingAutomationTabs />

      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Status dos Produtos</h1>
          <p className="text-muted-foreground mt-1">Veja o status de aprovação de cada produto no Google Merchant Center.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{statusCounts.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Em Análise</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{statusCounts.under_review}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Reprovados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{statusCounts.disapproved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Não Sincronizados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{statusCounts.not_synced}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Produtos</CardTitle>
                <CardDescription>Clique em um filtro para ver apenas produtos com esse status.</CardDescription>
              </div>
              <Button onClick={fetchProducts} disabled={refreshing} size="sm" variant="outline">
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {(["all", "approved", "under_review", "disapproved", "not_synced"] as const).map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className="text-xs"
                  >
                    {status === "all" && "Todos"}
                    {status === "approved" && "✓ Aprovados"}
                    {status === "under_review" && "⏳ Em análise"}
                    {status === "disapproved" && "✗ Reprovados"}
                    {status === "not_synced" && "Não sync"}
                  </Button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum produto encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium">Produto</th>
                      <th className="text-left py-2 px-2 font-medium">SKU</th>
                      <th className="text-right py-2 px-2 font-medium">Preço</th>
                      <th className="text-left py-2 px-2 font-medium">Status</th>
                      <th className="text-left py-2 px-2 font-medium">Problemas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((product) => (
                      <tr key={product.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            {product.imageUrl && (
                              <img
                                src={product.imageUrl}
                                alt={product.title}
                                className="h-10 w-10 rounded object-cover"
                              />
                            )}
                            <div>
                              <p className="font-medium line-clamp-1">{product.title}</p>
                              {product.lastSynced && (
                                <p className="text-xs text-muted-foreground">
                                  Sync: {new Date(product.lastSynced).toLocaleDateString("pt-BR")}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">{product.sku}</td>
                        <td className="py-3 px-2 text-right font-medium">$ {product.price.toFixed(2)}</td>
                        <td className="py-3 px-2">{getStatusBadge(product.status)}</td>
                        <td className="py-3 px-2 text-xs max-w-xs">
                          {product.issues && product.issues.length > 0 ? (
                            <div className="space-y-1">
                              {product.issues.slice(0, 2).map((issue, i) => (
                                <p key={i} className="text-muted-foreground line-clamp-1">
                                  • {issue.description}
                                </p>
                              ))}
                              {product.issues.length > 2 && <p className="text-muted-foreground">+{product.issues.length - 2} mais</p>}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
