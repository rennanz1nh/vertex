import LegalPageLayout from "@/components/store/LegalPageLayout";

export const metadata = { title: "Refund Policy – Vertex Rental Cars" };

const sections = [
  {
    heading: "A legal disclaimer",
    body: [
      "The explanations and information provided on this page are only general and high-level explanations and information on how to write your own document of a Cookie Policy. You should not rely on this article as legal advice or as recommendations regarding what you should actually do, because we cannot know in advance what are your specific cookie-related practices. We recommend that you seek legal advice to help you understand and to assist you in the creation of your own Cookie Policy.",
    ],
  },
  {
    heading: "Refund Policy - the basics",
    body: [
      "Having said that, a Refund Policy is a legally binding document that is meant to establish the legal relations between you and your customers regarding how and if you will provide them with a refund. Online businesses selling products are sometimes required (depending on local laws and regulations) to present their product return policy and refund policy. In some jurisdictions, this is needed in order to comply with consumer protection laws. It may also help you avoid legal claims from customers that are not satisfied with the products they purchased.",
    ],
  },
  {
    heading: "What to include in the Refund Policy",
    body: [
      "Generally speaking, a Refund Policy often addresses these types of issues: the timeframe for asking for a refund; will the refund be full or partial; under which conditions will the customer receive a refund; and much much more.",
    ],
  },
];

export default function RefundPolicyPage() {
  return <LegalPageLayout title="Refund Policy" sections={sections} />;
}
