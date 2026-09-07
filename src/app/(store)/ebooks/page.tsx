import ComingSoon from "@/components/store/ComingSoon";
import { buildPageMetadata } from "@/lib/site-settings";

export async function generateMetadata() {
  return buildPageMetadata("ebooks", "Ebooks — Vertex Rental Cars");
}

export default function Page() {
  return (
    <ComingSoon
      title="E-books"
      message="We don't have any products to show here right now."
    />
  );
}
