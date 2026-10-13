import { Suspense } from "react";
import TuroPage from "@/admin-pages/Turo";

export const metadata = { title: "Turo — Vertex Admin" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TuroPage />
    </Suspense>
  );
}
