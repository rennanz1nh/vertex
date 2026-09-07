import LegalPageLayout from "@/components/store/LegalPageLayout";

export const metadata = { title: "Shipping Policy – Vertex Rental Cars" };

const sections = [
  {
    heading: "A legal disclaimer",
    body: [
      "The explanations and information provided on this page are only general and high-level explanations and information on how to write your own document of a Cookie Policy. You should not rely on this article as legal advice or as recommendations regarding what you should actually do, because we cannot know in advance what are your specific cookie-related practices. We recommend that you seek legal advice to help you understand and to assist you in the creation of your own Cookie Policy.",
    ],
  },
  {
    heading: "Shipping Policy - the basics",
    body: [
      "Having said that, a Shipping Policy is a legally binding document that is meant to establish the legal relations between you and your customers. It is the legal framework for presenting your obligations to your customers, but also to address different possible scenarios that may occur, and what happens in each and every case.",
      "A Shipping Policy is a good practice and it helps both sides - you and your customers. Your customers may benefit from being informed about what they can expect from your service. You may benefit because people may be likely to shop with you if you have a clear Shipping Policy in place since there won't be any questions about your shipping timeframes or processes.",
    ],
  },
  {
    heading: "What to include in the Shipping Policy",
    body: [
      "Generally speaking, a Shipping Policy often addresses these types of issues: the timeframe for processing orders; the shipping costs; different domestic and international shipping solutions; potential service interruptions; and much much more.",
    ],
  },
];

export default function ShippingPolicyPage() {
  return <LegalPageLayout title="Shipping Policy" sections={sections} />;
}
