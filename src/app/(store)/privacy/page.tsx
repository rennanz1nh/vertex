import LegalPageLayout from "@/components/store/LegalPageLayout";

export const metadata = { title: "Privacy Policy – Vertex Rental Cars" };

const sections = [
  {
    heading: "A legal disclaimer",
    body: [
      "The information provided on this page is a general overview of our privacy practices. It is not intended as legal advice. We recommend that you consult with a qualified legal professional regarding any specific privacy-related concerns applicable to your jurisdiction.",
    ],
  },
  {
    heading: "Privacy Policy – the basics",
    body: [
      "At Vertex Rental Cars, your privacy is important to us. This Privacy Policy describes what personal information we may collect when you request a vehicle reservation, how we use it, and the choices you have regarding your data.",
      "By using our website or requesting a booking, you agree to the collection and use of information in accordance with this policy. We only collect information that is necessary to verify your eligibility to rent, process your reservation, and provide and improve our services.",
    ],
  },
  {
    heading: "Information we collect",
    body: [
      "We may collect the following types of information when you request a booking: your name, email address and phone number; driver information required to verify your eligibility to rent, including date of birth, driver's license number, license expiration date and issuing state; trip details such as pickup and return dates, selected protection plan and extras; and, where payment is enabled, billing information needed to process your reservation.",
      "We also collect browsing activity on our website, such as the vehicles and pages you view, to improve your experience and the availability of our fleet listings.",
      "We do not sell, rent, or trade your personal information to third parties for their marketing purposes.",
    ],
  },
  {
    heading: "How we use your information",
    body: [
      "The information we collect is used to verify your eligibility to rent, process and confirm your reservation, communicate with you about your booking, calculate applicable fees (such as the young-driver fee), improve our website and services, and comply with applicable legal obligations.",
      "We may share your information with trusted service providers who assist us in operating our business — such as our insurance partners and payment processor — solely for those purposes and under confidentiality agreements.",
    ],
  },
  {
    heading: "Data security",
    body: [
      "We take reasonable measures to protect your personal information, including sensitive driver's license details, from unauthorized access, disclosure, or misuse. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "Our website may use cookies to enhance your browsing experience. Cookies are small files stored on your device that help us understand how visitors interact with our site. You may choose to disable cookies through your browser settings, though some features of the website may not function properly as a result.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "You have the right to request access to, correction of, or deletion of your personal information that we hold, including driver information on file from a past booking. To make such a request, please contact us through our Contact page. We will respond within a reasonable timeframe.",
    ],
  },
  {
    heading: "Changes to this policy",
    body: [
      "We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. We encourage you to review this policy periodically.",
    ],
  },
  {
    heading: "Contact us",
    body: [
      "If you have any questions or concerns about this Privacy Policy, please reach out to us through our Contact page. We are happy to help.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return <LegalPageLayout title="Privacy Policy" sections={sections} />;
}
