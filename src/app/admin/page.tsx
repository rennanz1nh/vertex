"use client";

import Dashboard from "@/admin-pages/Dashboard";
import WebsiteAccessTab from "@/components/dashboard/WebsiteAccessTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminDashboardPage() {
  return (
    <Tabs defaultValue="dashboard" className="space-y-6 max-md:space-y-4">
      <TabsList className="max-md:grid max-md:w-full max-md:grid-cols-2">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="acessos">Acessos ao Site</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="mt-0">
        <Dashboard />
      </TabsContent>
      <TabsContent value="acessos" className="mt-0">
        <WebsiteAccessTab />
      </TabsContent>
    </Tabs>
  );
}
