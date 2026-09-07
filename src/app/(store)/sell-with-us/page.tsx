import Image from "next/image";
import PageBanner from "@/components/store/PageBanner";
import ContactForm from "@/components/store/ContactForm";
import { buildPageMetadata } from "@/lib/site-settings";

export async function generateMetadata() {
  return buildPageMetadata("sell-with-us", "Sell With Us — Vertex Rental Cars");
}

const benefits = [
  {
    title: "Increased Visibility",
    body: "Showcase your product on a platform dedicated to cosmetics, where your brand can shine and attract new customers.",
  },
  {
    title: "Access to a Qualified Customer Base",
    body: "Our audience consists of people searching for high-quality products in the beauty segment.",
  },
  {
    title: "Promotion and Marketing",
    body: "We provide support to promote your products through advertising campaigns and social media actions.",
  },
  {
    title: "Operational Ease",
    body: "Simple onboarding so you can focus on your products while we help you reach more customers.",
  },
];

export default function SellWithUsPage() {
  return (
    <>
      <PageBanner src="sell-with-us" alt="Sell with us" ext="png" />

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="font-display text-2xl md:text-3xl font-normal text-gray-900 text-center mb-6">
          Promote Your Product on Our Cosmetics Marketplace and Reach More Customers!
        </h1>

        <div className="text-center text-gray-600 text-sm leading-relaxed max-w-2xl mx-auto space-y-3 mb-10">
          <p>
            Are you looking for an opportunity to expand your product&apos;s visibility and reach
            new audiences? Our cosmetics marketplace is the perfect place for you!
          </p>
          <p>
            By joining us, you&apos;ll gain access to a network of customers passionate about
            personal care and beauty, eager to discover what you have to offer.
          </p>
        </div>

        <h2 className="font-display text-xl font-normal text-gray-900 text-center mb-6">
          Benefits of Bringing Your Product to Our Marketplace
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-14">
          {benefits.map((b) => (
            <div key={b.title} className="border-l-2 border-brand pl-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{b.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{b.body}</p>
            </div>
          ))}
        </div>

      </div>

      {/* Contact section: photo split with the form (matching the Wix site) */}
      <div id="reseller" className="max-w-[1600px] mx-auto px-4 pb-16">
        <h2 className="font-display text-2xl md:text-3xl font-normal text-gray-900 text-center mb-8">
          Contact us
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          <div className="relative min-h-[320px] md:min-h-0">
            <Image
              src="/images/sell-with-us-photo.jpg"
              alt="Become a partner"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <div>
            <ContactForm />
          </div>
        </div>
      </div>
    </>
  );
}
