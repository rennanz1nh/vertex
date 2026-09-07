import PageBanner from "@/components/store/PageBanner";
import ContactForm from "@/components/store/ContactForm";
import { buildPageMetadata } from "@/lib/site-settings";

export async function generateMetadata() {
  return buildPageMetadata("contact-us", "Contact Us — Vertex Rental Cars");
}

export default function ContactPage() {
  return (
    <>
      <PageBanner src="contact-us" alt="Contact us" ratio={6.39} />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-display text-3xl font-normal text-gray-900 text-center mb-8">
          Contact us
        </h1>
        <ContactForm />
      </div>
    </>
  );
}
