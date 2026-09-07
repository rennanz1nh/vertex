import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Package, TrendingUp } from "lucide-react";

interface TopProduct {
  productId: string;
  name: string;
  imageUrl: string | null;
  totalSold: number;
  totalRevenue: number;
}

interface TopSellingProductsProps {
  products: TopProduct[];
}

export const TopSellingProducts = ({ products }: TopSellingProductsProps) => {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  if (products.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Produtos Mais Vendidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Produtos Mais Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {products.map((product, index) => (
          <div
            key={product.productId}
            className="flex items-center gap-4"
          >
            <span className="text-sm font-bold text-muted-foreground w-5 text-center">
              {index + 1}
            </span>
            <Avatar className="h-10 w-10 rounded-md">
              <AvatarImage src={product.imageUrl || ''} alt={product.name} className="object-cover" />
              <AvatarFallback className="rounded-md bg-muted">
                <Package className="h-4 w-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                {product.totalSold} unid. vendidas
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">
              {formatCurrency(product.totalRevenue)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
