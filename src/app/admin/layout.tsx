"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthWrapper } from "@/components/AuthWrapper";
import { AdminLayout } from "@/components/AdminLayout";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AuthWrapper>
            <div style={{ "--primary": "0 0% 0%", "--ring": "0 0% 0%", "--secondary": "0 0% 88%", "--secondary-foreground": "0 0% 10%" } as React.CSSProperties}>
              <AdminLayout>{children}</AdminLayout>
            </div>
          </AuthWrapper>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
