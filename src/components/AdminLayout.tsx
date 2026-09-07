"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { EbayConnectionButton } from "@/components/ebay/EbayConnectionButton";
import { NotificationBell } from "@/components/NotificationBell";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface LayoutProps {
  children: React.ReactNode;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The eBay connection button in the shared header only makes sense on the eBay
// automation pages. Pedidos and Shipping's show it inline next to their own
// Sincronizar/Atualizar buttons instead (so it sits where it's actually relevant).
function showEbayButton(pathname: string): boolean {
  return pathname.startsWith("/admin/automations/ebay");
}

export const AdminLayout = ({ children }: LayoutProps) => {
  const pathname = usePathname();
  const { profile } = useAuth();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b border-gray-200 bg-white px-4 sticky top-0 z-20">
            <SidebarTrigger className="w-11 h-11 p-2.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 [&_svg]:size-5" />
            <div className="flex flex-col justify-center min-w-0">
              <span className="app-title text-xl text-gray-900 truncate leading-tight">Vertex Rental Cars Platform</span>
              <span className="text-[11px] italic text-gray-400 leading-tight">by: Vertex Rental Cars</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              {showEbayButton(pathname) && <EbayConnectionButton />}
              {profile && (
                <Badge className="bg-gold-leaf text-white hover:bg-gold-leaf text-[10px] uppercase tracking-wide">
                  {capitalize(profile.role)}
                </Badge>
              )}
              <NotificationBell />
              <Link
                href="/"
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                <Store className="h-4 w-4" />
                Loja
              </Link>
            </div>
          </header>
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};