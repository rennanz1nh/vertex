import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import GoogleTranslate from "@/components/store/GoogleTranslate";
import ClearanceRail from "@/components/store/ClearanceRail";
import HideOnCheckoutFlow from "@/components/store/HideOnCheckoutFlow";
import NewsletterSection from "@/components/store/NewsletterSection";
import ChatWidget from "@/components/store/ChatWidget";
import WhatsAppButton from "@/components/store/WhatsAppButton";
import BannerPopupManager from "@/components/store/BannerPopupManager";
import { ButtonClickTracker } from "@/components/store/ButtonClickTracker";
import { VisitTracker } from "@/components/store/VisitTracker";
import SiteScripts, { GtmNoScript } from "@/components/SiteScripts";
import { supabase } from "@/lib/supabase";
import type { Banner } from "@/lib/banners";
import { getSiteSettings } from "@/lib/site-settings";
import { resolveSiteUrl } from "@/lib/seo";

export const revalidate = 60;

// Builds the LocalBusiness structured data from the Google Business fields in
// Settings — helps Google show address/hours in local search results.
function localBusinessJsonLd(s: Awaited<ReturnType<typeof getSiteSettings>>) {
  if (!s || !s.business_name) return null;
  const siteUrl = resolveSiteUrl(s);
  const address: Record<string, string> = {};
  if (s.business_street) address.streetAddress = s.business_street;
  if (s.business_city) address.addressLocality = s.business_city;
  if (s.business_state) address.addressRegion = s.business_state;
  if (s.business_zip) address.postalCode = s.business_zip;
  if (s.business_country) address.addressCountry = s.business_country;

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: s.business_name,
    url: siteUrl,
    ...(s.business_phone ? { telephone: s.business_phone } : {}),
    ...(s.business_email ? { email: s.business_email } : {}),
    ...(Object.keys(address).length ? { address: { "@type": "PostalAddress", ...address } } : {}),
    ...(s.business_hours ? { openingHours: s.business_hours } : {}),
    ...(s.business_maps_url ? { hasMap: s.business_maps_url } : {}),
  };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [{ data }, settings] = await Promise.all([
    supabase
      .from("banners")
      .select("*")
      .eq("placement", "popup")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    getSiteSettings(),
  ]);

  const business = localBusinessJsonLd(settings);

  return (
    <>
      {business && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(business) }}
        />
      )}
      <GtmNoScript />
      <ButtonClickTracker />
      <VisitTracker />
      <GoogleTranslate />
      <Header />
      <main className="flex-1">{children}</main>
      <HideOnCheckoutFlow>
        <ClearanceRail />
      </HideOnCheckoutFlow>
      <NewsletterSection />
      <Footer />
      <HideOnCheckoutFlow>
        <WhatsAppButton phoneNumber={settings?.whatsapp_number} />
        <ChatWidget />
      </HideOnCheckoutFlow>
      <BannerPopupManager banners={(data as Banner[] | null) ?? []} />
      <SiteScripts />
    </>
  );
}
