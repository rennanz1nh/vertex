import CategoryListing from "@/components/store/CategoryListing";
import { CATEGORIES } from "@/lib/categories";
import { buildPageMetadata } from "@/lib/site-settings";

export const revalidate = 60;

export function generateMetadata() {
  return buildPageMetadata("clearance", "Sale | Clearance — Vertex Rental Cars");
}

export default function Page() {
  return <CategoryListing cfg={CATEGORIES.clearance} />;
}
