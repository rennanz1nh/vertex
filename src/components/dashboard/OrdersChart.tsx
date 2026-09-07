import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";

interface OrdersChartProps {
  data: Array<{
    month: string;
    orders: number;
  }>;
}

const chartConfig = {
  orders: {
    label: "Pedidos",
    color: "hsl(var(--secondary))",
  },
};

export const OrdersChart = ({ data }: OrdersChartProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos por Mês</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line 
                type="monotone" 
                dataKey="orders" 
                stroke="var(--color-orders)" 
                strokeWidth={2}
                dot={{ fill: "var(--color-orders)" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};