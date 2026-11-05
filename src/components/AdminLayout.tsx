"use client";

import { V2Shell } from "@/components/admin-v2/V2Shell";

interface LayoutProps {
  children: React.ReactNode;
}

export const AdminLayout = ({ children }: LayoutProps) => <V2Shell>{children}</V2Shell>;
