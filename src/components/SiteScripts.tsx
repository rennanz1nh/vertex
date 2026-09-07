import Script from "next/script";
import { getSiteSettings } from "@/lib/site-settings";

// Injects the marketing/analytics tags configured in Admin > Settings > Google/Facebook.
// Only runs on deployed environments (VERCEL set) and only for tags that have an ID —
// so localhost stays out of your analytics and nothing loads until you configure it.
export default async function SiteScripts() {
  if (!process.env.VERCEL) return null;

  const s = await getSiteSettings();
  if (!s) return null;

  const ga4 = s.ga4_measurement_id?.trim();
  const gtm = s.gtm_container_id?.trim();
  const ads = s.google_ads_conversion_id?.trim();
  const pixel = s.facebook_pixel_id?.trim();

  // gtag.js is shared by GA4 and Google Ads — load it once, then config each id.
  const gtagId = ga4 || ads;

  return (
    <>
      {gtm && (
        <Script id="gtm" strategy="afterInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');
        `}</Script>
      )}

      {gtagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="afterInteractive"
          />
          <Script id="gtag-init" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            ${ga4 ? `gtag('config', '${ga4}');` : ""}
            ${ads ? `gtag('config', '${ads}');` : ""}
          `}</Script>
        </>
      )}

      {pixel && (
        <Script id="fb-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${pixel}');
          fbq('track', 'PageView');
        `}</Script>
      )}
    </>
  );
}

// GTM recommends a <noscript> iframe immediately after <body>. Rendered separately
// so it can sit at the top of the body.
export async function GtmNoScript() {
  if (!process.env.VERCEL) return null;
  const s = await getSiteSettings();
  const gtm = s?.gtm_container_id?.trim();
  if (!gtm) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="gtm"
      />
    </noscript>
  );
}
