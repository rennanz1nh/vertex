// Content for the Rental Agreement shown at checkout, sourced from the signed
// "Vertex Rental Car USA LLC — Motor Vehicle Rental Agreement" template. Only the General
// Rental Terms and the express acknowledgments are shown here — the Rental Order fill-in
// table (vehicle/pickup condition/odometer fields meant to be completed at in-person
// pickup) and the "Essential Acceptance" block that assumes the vehicle was already
// received don't apply to an online pre-payment acceptance step, so they're left out.
//
// Bump this whenever the wording changes — it's stored on every booking alongside the
// signature so a later edit here never rewrites what a past renter actually agreed to.
export const RENTAL_AGREEMENT_VERSION = "2026-09-19";

export type AgreementSection = {
  heading: string;
  body: string[];
  bullets?: string[];
  notice?: string; // a statutory/regulatory callout shown boxed, never smaller than body text
};

export const RENTAL_AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    heading: "1. Parties, Vehicle, and Rental Term",
    body: [
      "Vertex Rental Car USA LLC (“LESSOR”) rents to the RENTER the vehicle identified in the booking. Authorized possession begins upon delivery and ends only when the vehicle and keys are returned and the vehicle is inspected by the LESSOR. Any changes or extensions require express approval and corresponding payment.",
    ],
  },
  {
    heading: "2. Driver License and Authorized Drivers",
    body: [
      "The RENTER and each additional driver must be at least 21 years old, present a valid driver license, and satisfy the requirements of the LESSOR and its insurer. The RENTER is responsible for the acts of all drivers and may not allow an unauthorized person to operate the vehicle. The LESSOR will verify and maintain the records required by Florida Statutes § 322.38.",
    ],
  },
  {
    heading: "3. Payment, Security Deposit, and Charges",
    body: [
      "The RENTER will pay the rental rate, taxes, rental car surcharge, excess mileage, fuel, tolls, fines, extraordinary cleaning, damage, loss of use, diminution in value, towing, storage, recovery, and any other amounts due. The security deposit or pre-authorization does not limit total liability. The RENTER authorizes charges to the payment method on file, including after return of the vehicle, upon reasonable documentation. Unpaid amounts may include collection costs, court costs, and attorneys’ fees awarded as permitted by law.",
    ],
  },
  {
    heading: "4. Insurance and Third-Party Liability",
    body: [
      "The damage limitation provided under this agreement applies only to physical damage to the vehicle and does not provide liability insurance, PIP, medical coverage, UM/UIM coverage, or coverage for personal property. The RENTER must provide information regarding their insurance when requested and cooperate with any investigation. To the extent permitted by law, the RENTER will be liable for and indemnify the LESSOR against third-party claims arising from the RENTER’s use of the vehicle, breach of this agreement, negligence, intentional misconduct, or acts of drivers under the RENTER’s responsibility, without excluding the LESSOR’s legal responsibility for its own conduct.",
    ],
    notice:
      "PRIMARY INSURANCE STATUTORY NOTICE: “The valid and collectible liability insurance and personal injury protection insurance of any authorized rental or leasing driver is primary for the limits of liability and personal injury protection coverage required by ss. 324.021(7) and 627.736, Florida Statutes.”",
  },
  {
    heading: "5. Contractual Damage Limitation",
    body: [
      "If expressly selected in the booking, paid for, and not invalidated, the Damage Limitation reduces the RENTER’s responsibility for collision damage to the vehicle to the amount stated, per occurrence. It is not insurance.",
    ],
    bullets: [
      "Does not cover: tires, wheels, glass, interior, keys, incorrect fuel, wear and tear, loss of use, diminution in value, fees, theft, robbery, misappropriation, vandalism, fire, flooding, hail, falling objects, or damage not directly resulting from a collision.",
      "Becomes void in the event of an unauthorized driver, alcohol/drug use, unlawful conduct, racing, off-road use, unauthorized towing, false information, abandonment, improper flight from the scene, delayed reporting, or a material breach of this agreement.",
      "Limited liability may be reinstated only by written confirmation from the LESSOR after each occurrence.",
    ],
  },
  {
    heading: "6. Permitted Use and Territory",
    body: [
      "The vehicle must be used with due care, in compliance with the law and the manufacturer’s instructions. Use for compensation, delivery services, rideshare, competition, testing, towing, unlawful transportation, subleasing, off-road use, driving under the influence of substances, or any modification or repair without authorization is prohibited. The vehicle may not leave Florida, enter another country, or be transported by vessel without written authorization. The RENTER must not leave keys or documents in the vehicle or drive through flooded areas.",
    ],
  },
  {
    heading: "7. Accident, Breakdown, Theft, or Impoundment",
    body: [
      "The RENTER must stop safely, obtain assistance, call the police when required or when there are injuries, third parties involved, theft, or robbery, refrain from admitting fault, document evidence, and notify the LESSOR immediately or, if demonstrably impossible, within 24 hours. The RENTER must provide the police report, information regarding third parties and insurers, notices, and fully cooperate. In the event of a breakdown, the RENTER must stop using the vehicle when warnings indicate a risk and request instructions before arranging any repair or towing.",
    ],
  },
  {
    heading: "8. Damage, Inspection, and Reimbursement",
    body: [
      "The vehicle must be returned in its initial condition, except for normal wear and tear. The LESSOR may document pickup and return and report hidden damage that could not reasonably have been identified earlier within 10 business days, accompanied by supporting evidence. The LESSOR will select a reasonable repair facility and repair method. The RENTER will be responsible for documented costs of repair, towing, storage, appraisal, loss of use for a reasonable period, diminution in value, and recovery, less any amounts actually received from third parties or insurance for the same loss.",
    ],
  },
  {
    heading: "9. Return, Late Return, and Recovery",
    body: [
      "There is a 30-minute grace period. From 31 minutes to 2 hours late, a charge of US$ 15 applies for each started hour; after 2 hours, one additional rental day, the Damage Limitation charge, taxes, and applicable fees will be charged, without converting the late return into an authorized extension. Without authorization or contact, the LESSOR may terminate permission to use the vehicle and take lawful measures to recover it, without trespass or breach of the peace. Daily rental charges and costs continue until the vehicle is actually recovered and inspected.",
    ],
  },
  {
    heading: "10. Fuel, Cleaning, Tolls, and Fines",
    body: [
      "The vehicle must be returned with the same fuel level; any difference will be charged at the cost of refueling plus US$ 15. The full cost resulting from incorrect fuel will be charged. Normal cleaning is included; extraordinary cleaning, smoking/vaping residue, odors, stains, bodily or other fluids, sand, mud, or pet hair will be charged based on reasonable documented cost. Tolls, fines, parking charges, impoundment costs, and a reasonable administrative fee arising during the rental period are the responsibility of the RENTER, even if assessed after the rental.",
    ],
  },
  {
    heading: "11. Tracking, Data, and Communications",
    body: [
      "When installed, the RENTER authorizes the use of GPS and telematics for security, location, mileage, fraud prevention, recovery, and incident analysis. Data may be shared with insurers, service providers, and authorities when necessary. Communications sent to the contact information provided will be valid, and the RENTER must keep that information current. The LESSOR will process data to perform this agreement and comply with legal obligations.",
    ],
  },
  {
    heading: "12. Cancellation, Governing Law, and Acceptance",
    body: [
      "Cancellations made 48 hours or more in advance will receive a full refund; for cancellations made less than 48 hours in advance, 20% may be retained; a no-show authorizes full retention, except where mandatory law provides otherwise. Early return does not automatically result in a refund. This agreement, the booking details, the checklist, and the records constitute the entire agreement. Florida law applies; venue is selected in the state courts of Orange County, Florida, without excluding any mandatory jurisdiction. Electronic signatures are valid. If there is a final validated English version, it will prevail in the event of any discrepancy.",
    ],
  },
];

export const RENTAL_AGREEMENT_ACKNOWLEDGMENTS = [
  "I authorize subsequent charges and acknowledge that the security deposit does not limit my liability.",
  "I have read the primary insurance notice and understand that the Damage Limitation is not liability insurance.",
  "I authorize GPS/telematics, when installed, for the purposes described above.",
  "I was given the opportunity to review this agreement and accept its terms.",
] as const;
