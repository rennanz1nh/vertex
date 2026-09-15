import LegalPageLayout from "@/components/store/LegalPageLayout";

export const metadata = { title: "Terms & Conditions – Vertex Rental Cars" };

const sections = [
  {
    heading: "A legal disclaimer",
    body: [
      "The explanations and information provided on this page are only general and high-level explanations and information on how to write your own Rental Terms & Conditions document. You should not rely on this article as legal advice or as a recommendation regarding what you should actually do, because we cannot know in advance the specific regulatory requirements that apply to your rental operation. We recommend that you seek legal advice to help you understand and to assist you in the creation of your own Terms & Conditions.",
    ],
  },
  {
    heading: "Terms & Conditions - the basics",
    body: [
      "These Terms & Conditions (“T&C”) are a set of legally binding terms defined by Vertex Rental Cars that govern the use of this website and every vehicle reservation made through it. They establish the legal relationship between you, the renter, and Vertex Rental Cars, from the moment you request a booking through the return of the vehicle.",
      "By requesting a booking, you confirm that you have read, understood and agree to these Terms & Conditions, as well as to the Privacy Policy and Refund Policy referenced below.",
    ],
  },
  {
    heading: "Eligibility to rent",
    body: [
      "To rent a vehicle you must be at least 18 years old, hold a valid driver's license that authorizes you to legally operate a vehicle in the United States, and be able to provide a valid form of payment in your own name.",
      "Drivers under 25 years old may be subject to an additional young-driver fee, charged per day, as shown in the price breakdown before you submit a booking request. Vertex Rental Cars reserves the right to refuse a rental to any applicant who does not meet these requirements or whose license cannot be verified.",
    ],
  },
  {
    heading: "Bookings and pricing",
    body: [
      "A booking made through this website is a request to rent a vehicle for the dates, protection plan and extras you selected — it is not confirmed until reviewed and approved by our team. The price shown at checkout is an estimate based on the daily rate, trip length, protection plan, selected extras and any applicable driver fees, and may be adjusted if the details of your trip change.",
      "Vertex Rental Cars reserves the right to decline or cancel a booking request at any time prior to confirmation, including for failed driver verification, vehicle unavailability, or suspected fraudulent activity.",
    ],
  },
  {
    heading: "Protection plans and extras",
    body: [
      "Every trip includes one of our protection plans (Basic, Standard or Premium), each carrying a different deductible that limits your financial responsibility for damage to the vehicle during your rental. Choosing a higher deductible plan does not waive liability for damage resulting from a violation of these Terms & Conditions, reckless conduct, or excluded uses described below.",
      "Optional extras (such as an additional driver, unlimited mileage, or prepaid refueling) apply only when selected and paid for as part of your booking. Any driving, mileage or refueling outside the scope of your selected extras may be billed separately after the trip.",
    ],
  },
  {
    heading: "Using the vehicle",
    body: [
      "The vehicle may only be driven by the renter and any additional drivers explicitly added to the booking. You agree to operate the vehicle in compliance with all applicable traffic laws and to use it only for lawful, personal purposes.",
      "The following uses are strictly prohibited and are not covered by any protection plan: racing or speed testing; off-road driving; towing or pushing another vehicle; subletting or re-renting the vehicle to a third party; driving under the influence of alcohol or drugs; using the vehicle to commit an unlawful act; and driving outside the geographic area agreed upon at booking.",
    ],
  },
  {
    heading: "Driver responsibilities",
    body: [
      "You are responsible for picking up and returning the vehicle at the agreed date, time and location, in the same condition it was received, less normal wear and tear. Late returns may incur additional daily charges at the rate shown on your booking.",
      "You are responsible for any traffic violations, tolls, parking citations or fines incurred while the vehicle is in your possession, and you must report any accident, damage, theft or mechanical issue to Vertex Rental Cars as soon as it is safe to do so.",
    ],
  },
  {
    heading: "Damage, loss and liability",
    body: [
      "You are financially responsible for any loss of or damage to the vehicle during your rental period, up to the deductible of your selected protection plan, except where the damage results from a prohibited use described above — in which case you may be held responsible for the full cost of repair or replacement, regardless of the plan selected.",
      "To the maximum extent permitted by law, Vertex Rental Cars is not liable for indirect, incidental or consequential damages arising from the use of a rented vehicle, and our total liability to you will not exceed the amount paid for the reservation giving rise to the claim.",
    ],
  },
  {
    heading: "Cancellations and refunds",
    body: [
      "Cancelling or modifying a confirmed reservation is subject to our Refund Policy, which explains the applicable timeframes and any fees that may apply depending on how close to pickup the change is requested.",
    ],
  },
  {
    heading: "Changes to these Terms",
    body: [
      "We may update these Terms & Conditions from time to time to reflect changes in our services or applicable law. Continuing to use this website or request a booking after changes are posted constitutes acceptance of the updated Terms.",
    ],
  },
  {
    heading: "Questions",
    body: [
      "If you have any questions about these Terms & Conditions, please reach out to us through our Contact page.",
    ],
  },
];

export default function TermsPage() {
  return <LegalPageLayout title="Terms & Conditions" sections={sections} />;
}
