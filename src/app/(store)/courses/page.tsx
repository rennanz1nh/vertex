import ComingSoon from "@/components/store/ComingSoon";
import { buildPageMetadata } from "@/lib/site-settings";

export async function generateMetadata() {
  return buildPageMetadata("courses", "Courses — Vertex Rental Cars");
}

export default function Page() {
  return <ComingSoon banner="courses" title="All Courses" message="Coming soon..." />;
}
