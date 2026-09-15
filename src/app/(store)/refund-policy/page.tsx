import LegalPageLayout from "@/components/store/LegalPageLayout";

export const metadata = { title: "Refund Policy – Vertex Rental Cars" };

const sections = [
  {
    heading: "A legal disclaimer",
    body: [
      "The explanations and information provided on this page are only general and high-level explanations and information on how to write your own Cancellation & Refund Policy document. You should not rely on this article as legal advice or as a recommendation regarding what you should actually do, because we cannot know in advance the specific regulatory requirements that apply to your rental operation. We recommend that you seek legal advice to help you understand and to assist you in the creation of your own policy.",
    ],
  },
  {
    heading: "Refund Policy - the basics",
    body: [
      "This Refund Policy explains how and when you may receive a refund if you cancel or modify a vehicle reservation made with Vertex Rental Cars. It is meant to set clear expectations for both sides: you know what to expect if your plans change, and we can plan our fleet availability around confirmed bookings.",
    ],
  },
  {
    heading: "Cancelling before pickup",
    body: [
      "Cancellations made at least 48 hours before the scheduled pickup time are eligible for a full refund of any amount paid.",
      "Cancellations made less than 48 hours before pickup are eligible for a 50% refund, to account for the vehicle being held for you and taken off the fleet on short notice.",
      "Cancellations made after the scheduled pickup time, or trips that are never picked up (a no-show), are not eligible for a refund.",
    ],
  },
  {
    heading: "Changes to a confirmed booking",
    body: [
      "You may request to shorten, extend or otherwise modify a confirmed reservation by contacting us before your pickup date. Shortening a trip is treated the same as a partial cancellation for the days removed, under the timeframes above. Extensions are subject to vehicle availability and are billed at the daily rate in effect at the time of the request.",
    ],
  },
  {
    heading: "Ending a trip early",
    body: [
      "If you return the vehicle earlier than the confirmed return date, the unused days are not automatically refunded, since the vehicle was reserved and unavailable to other renters for the full length of your trip. Reach out to us if you'd like to discuss your specific situation.",
    ],
  },
  {
    heading: "Damage and cleaning deductions",
    body: [
      "Any amount owed for damage beyond normal wear and tear, missing fuel, excessive cleaning, or fees incurred during your rental (such as tolls or citations) will be deducted from your deposit or charged separately before any refund is issued, regardless of the reason for cancellation.",
    ],
  },
  {
    heading: "How refunds are issued",
    body: [
      "Eligible refunds are returned to the original payment method used at booking. Please allow a few business days for the refund to appear, depending on your bank or card issuer.",
    ],
  },
  {
    heading: "Questions",
    body: [
      "If you believe a charge was made in error, or you'd like to discuss a cancellation that falls outside these guidelines, please reach out to us through our Contact page — we review these on a case-by-case basis.",
    ],
  },
];

export default function RefundPolicyPage() {
  return <LegalPageLayout title="Refund Policy" sections={sections} />;
}
