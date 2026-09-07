// Official Google and Facebook/Meta brand marks as inline SVG, so they render with
// their real colors anywhere (settings tabs + page headers). No external assets.

import { useId } from "react";

type Props = { className?: string };

export function GoogleLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Google" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function FacebookLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Facebook" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#1877F2"
        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
      />
    </svg>
  );
}

/** Meta's brand blue is a gradient (light #0082FB to dark #0064E0), not a flat color —
 *  a fresh gradient id per instance keeps multiple copies on one page from colliding. */
export function MetaLogo({ className }: Props) {
  const gradId = `meta-grad-${useId()}`;
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Meta" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0082FB" />
          <stop offset="100%" stopColor="#0064E0" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradId})`}
        d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"
      />
    </svg>
  );
}

/** Two-tone orange/amber gradient — Google Analytics' brand colors (#E37400, #F9AB00). */
export function GoogleAnalyticsLogo({ className }: Props) {
  const gradId = `ga-grad-${useId()}`;
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Google Analytics" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F9AB00" />
          <stop offset="100%" stopColor="#E37400" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradId})`}
        d="M22.84 2.9982v17.9987c.0086 1.6473-1.3197 2.9897-2.967 2.9984a2.9808 2.9808 0 01-.3677-.0208c-1.528-.226-2.6477-1.5558-2.6105-3.1V3.1204c-.0369-1.5458 1.0856-2.8762 2.6157-3.1 1.6361-.1915 3.1178.9796 3.3093 2.6158.014.1201.0208.241.0202.3619zM4.1326 18.0548c-1.6417 0-2.9726 1.331-2.9726 2.9726C1.16 22.6691 2.4909 24 4.1326 24s2.9726-1.3309 2.9726-2.9726-1.331-2.9726-2.9726-2.9726zm7.8728-9.0098c-.0171 0-.0342 0-.0513.0003-1.6495.0904-2.9293 1.474-2.891 3.1256v7.9846c0 2.167.9535 3.4825 2.3505 3.763 1.6118.3266 3.1832-.7152 3.5098-2.327.04-.1974.06-.3983.0593-.5998v-8.9585c.003-1.6474-1.33-2.9852-2.9773-2.9882z"
      />
    </svg>
  );
}

/** Google Tag Manager's mark is a flat Google Blue. */
export function GoogleTagManagerLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Google Tag Manager" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M12.003 0a3 3 0 0 0-2.121 5.121l6.865 6.865-4.446 4.541 1.745 1.836a3.432 3.432 0 0 1 .7.739l.012.011-.001.002a3.432 3.432 0 0 1 .609 1.953 3.432 3.432 0 0 1-.09.78l7.75-7.647c.031-.029.067-.05.098-.08.023-.023.038-.052.06-.076a2.994 2.994 0 0 0-.06-4.166l-9-9A2.99 2.99 0 0 0 12.003 0zM8.63 2.133L.88 9.809a2.998 2.998 0 0 0 0 4.238l7.7 7.75a3.432 3.432 0 0 1-.077-.729 3.432 3.432 0 0 1 3.431-3.431 3.432 3.432 0 0 1 .826.101l-5.523-5.81 4.371-4.373-2.08-2.08c-.903-.904-1.193-2.183-.898-3.342zm3.304 16.004a2.932 2.932 0 0 0-2.931 2.931A2.932 2.932 0 0 0 11.934 24a2.932 2.932 0 0 0 2.932-2.932 2.932 2.932 0 0 0-2.932-2.931z"
      />
    </svg>
  );
}

/** Google Ads' mark: a blue dot plus a green/yellow diagonal "kite" shape, using
 *  Google's standard four-color palette. */
export function GoogleAdsLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Google Ads" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M3.9998 22.9291C1.7908 22.9291 0 21.1383 0 18.9293s1.7908-3.9998 3.9998-3.9998 3.9998 1.7908 3.9998 3.9998-1.7908 3.9998-3.9998 3.9998z"
      />
      <path
        fill="#34A853"
        d="M23.4641 16.9287L15.4632 3.072C14.3586 1.1587 11.9121.5028 9.9988 1.6074S7.4295 5.1585 8.5341 7.0718l8.0009 13.8567c1.1046 1.9133 3.5511 2.5679 5.4644 1.4646 1.9134-1.1046 2.568-3.5511 1.4647-5.4644z"
      />
      <path
        fill="#FBBC04"
        d="M7.5137 4.8438L1.5645 15.1484A4.5 4.5 0 0 1 4 14.4297c2.5597-.0075 4.6248 2.1585 4.4941 4.7148l3.2168-5.5723-3.6094-6.25c-.4499-.7793-.6322-1.6394-.5878-2.4784z"
      />
    </svg>
  );
}

/** Google Cloud's official product icon (uploaded to public/images — not redrawn). */
export function GoogleCloudLogo({ className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/claude.png" alt="Google Cloud" className={className} />;
}

/** Google Search Console's official product icon (uploaded to public/images — not redrawn). */
export function GoogleSearchConsoleLogo({ className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/google-search-console-icon-filled-256.png" alt="Google Search Console" className={className} />;
}

/** Google Merchant Center's mark: a rounded square split into an indigo header band and
 *  a brighter blue body, with a white price/hang tag (rounded body + punched hole) in the
 *  center — matches the app icon Google itself uses for Merchant Center. */
export function GoogleMerchantCenterLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Google Merchant Center" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4A86F7" d="M4 12a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v24a8 8 0 0 1-8 8H12a8 8 0 0 1-8-8V12z" />
      <path fill="#5C6BC0" d="M4 12a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v6H4v-6z" />
      <path
        fill="#FFFFFF"
        d="M24.2 14.5h7.3a2 2 0 0 1 2 2v7.3a2 2 0 0 1-.586 1.414L21.914 36.2a2 2 0 0 1-2.828 0l-6.286-6.286a2 2 0 0 1 0-2.828L21.786 16.1a2 2 0 0 1 1.414-.586l1-1.014z"
        opacity=".95"
      />
      <circle cx="29" cy="19.5" r="1.6" fill="#4A86F7" />
    </svg>
  );
}

/** Brevo's official mark (uploaded to public/images — not redrawn). */
export function BrevoLogo({ className }: Props) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/sales-channels/Brevo.png" alt="Brevo" className={className} />;
}

/** Instagram's official camera glyph on its signature orange-to-purple gradient. */
export function InstagramLogo({ className }: Props) {
  const gradId = `ig-grad-${useId()}`;
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Instagram" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFDD55" />
          <stop offset="35%" stopColor="#FF543E" />
          <stop offset="65%" stopColor="#C837AB" />
          <stop offset="100%" stopColor="#5B51D8" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradId})`}
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.198-4.354-2.618-6.78-6.98-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
      />
    </svg>
  );
}

/** TikTok's official "musical note" mark (flat black — the monochrome variant of the brand mark). */
export function TikTokLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="TikTok" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#000000"
        d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z"
      />
    </svg>
  );
}

/** YouTube's official play-button mark. */
export function YouTubeLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="YouTube" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#FF0000"
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
      />
      <path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

/** Pinterest's official "P" mark. */
export function PinterestLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Pinterest" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#E60023"
        d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.004 2.35-1.496 3.146 1.126.348 2.317.535 3.554.535 6.627 0 12-5.373 12-12S18.627 0 12 0z"
      />
    </svg>
  );
}

/** Stripe's official mark, in their brand purple. */
export function StripeLogo({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Stripe" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#635BFF"
        d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.912 3.445 1.517 3.445 2.481 0 .93-.804 1.474-2.24 1.474-1.79 0-4.775-.87-6.914-2.02L3.5 20.884c1.881.982 5.4 2.014 8.939 2.014 2.72 0 4.955-.66 6.464-1.878 1.669-1.318 2.523-3.235 2.523-5.677 0-4.106-2.573-5.845-6.505-7.36l-1.045-.408z"
      />
    </svg>
  );
}
