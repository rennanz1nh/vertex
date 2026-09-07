"use client";

import Reports from "@/admin-pages/Reports";
import WebsiteAccessTab from "@/components/dashboard/WebsiteAccessTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminDashboardPage() {
  return (
    <Tabs defaultValue="vendas" className="space-y-6">
      <TabsList>
        <TabsTrigger value="vendas">Vendas</TabsTrigger>
        <TabsTrigger value="acessos">Acessos ao Site</TabsTrigger>
      </TabsList>
      <TabsContent value="vendas" className="mt-0">
        <Reports />
      </TabsContent>
      <TabsContent value="acessos" className="mt-0">
        <WebsiteAccessTab />
      </TabsContent>
    </Tabs>
  );
}
