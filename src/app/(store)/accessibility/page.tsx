import LegalPageLayout from "@/components/store/LegalPageLayout";

export const metadata = { title: "Accessibility Statement – Vertex Rental Cars" };

const sections = [
  {
    heading: "Our commitment",
    body: [
      "Vertex Rental Cars is committed to ensuring that our website is accessible to as many people as possible, including those with disabilities. We are continually working to improve the accessibility of our site and to provide an inclusive experience for all visitors.",
    ],
  },
  {
    heading: "Ongoing efforts",
    body: [
      "We strive to make our website easier to use and more accessible by following generally accepted web accessibility practices. This is an ongoing effort, and we regularly review and update our website with accessibility in mind.",
      "Our team works to ensure that the website can be navigated using a keyboard, that images include descriptive text where appropriate, and that color contrast supports readability for users with visual impairments.",
    ],
  },
  {
    heading: "Limitations",
    body: [
      "While we work toward providing an accessible experience, some content or features on our website may not yet meet all accessibility guidelines. We are aware that accessibility is a continuous process and we are dedicated to making improvements over time.",
    ],
  },
  {
    heading: "Contact us",
    body: [
      "If you experience any difficulty accessing content on our website, or if you have suggestions on how we can improve accessibility, please reach out to us. We welcome your feedback and will do our best to address your concerns in a timely manner.",
    ],
  },
];

export default function AccessibilityPage() {
  return <LegalPageLayout title="Accessibility Statement" sections={sections} />;
}
