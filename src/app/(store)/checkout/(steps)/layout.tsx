import { CheckoutProvider } from "./CheckoutContext";

// Route group (no URL segment) so this provider wraps only the three step pages
// (/checkout, /checkout/review, /checkout/agreement) and not the unrelated
// /checkout/success or /checkout/cancel routes next to it.
export default function CheckoutStepsLayout({ children }: { children: React.ReactNode }) {
  return <CheckoutProvider>{children}</CheckoutProvider>;
}
