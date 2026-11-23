"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthWrapper } from "@/components/AuthWrapper";
import { AdminLayout } from "@/components/AdminLayout";
import { ConfirmProvider } from "@/components/admin/confirm-dialog";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ConfirmProvider>
            <AuthWrapper>
              <AdminLayout>{children}</AdminLayout>
            </AuthWrapper>
          </ConfirmProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
