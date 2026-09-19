import { createClient } from "@supabase/supabase-js";
import { sendTransactionalEmail } from "@/lib/brevo";

export type EmailTriggerKey =
  | "booking_confirmed"
  | "order_confirmation"
  | "order_shipped"
  | "order_delivered"
  | "order_cancelled"
  | "order_refunded"
  | "newsletter_welcome"
  | "abandoned_cart";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}

/** Strips an email's HTML down to a readable plain-text alternative — sent alongside
 *  htmlContent as textContent. Missing a plain-text part is one of the things spam
 *  filters weigh against HTML-only mail, so every send (real + test) includes one. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Fires one of the automatic emails configured in Settings → E-mails Automáticos.
 * Always swallows its own errors — a missing BREVO_API_KEY, a disabled trigger, or a
 * Brevo API hiccup must never break the checkout webhook / newsletter signup / order
 * sync that called this, since sending a follow-up email is never the critical path.
 */
export async function sendAutomaticEmail(
  triggerKey: EmailTriggerKey,
  to: { email: string; name?: string },
  vars: Record<string, string>
): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data: row, error } = await supabase
      .from("automatic_emails")
      .select("enabled, subject, html_content, sender_name, sender_email")
      .eq("trigger_key", triggerKey)
      .maybeSingle();

    if (error || !row || !row.enabled) return;

    const htmlContent = renderTemplate(row.html_content, vars);
    await sendTransactionalEmail({
      to: [{ email: to.email, name: to.name }],
      subject: renderTemplate(row.subject, vars),
      htmlContent,
      textContent: htmlToPlainText(htmlContent),
      sender: row.sender_email ? { name: row.sender_name || "Vertex Rental Cars", email: row.sender_email } : undefined,
    });
  } catch (err) {
    console.error(`sendAutomaticEmail(${triggerKey}) failed`, err);
  }
}

/** Abandoned-cart's own delay_hours doubles as the Checkout Session's expires_at —
 *  Stripe only tells us a session "expired", so how long that takes IS how long until
 *  we consider the cart abandoned. Falls back to Stripe's own minimum (30min) → a safe
 *  4h default if the trigger row/column isn't set. */
export async function getAbandonedCartDelayHours(): Promise<number> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("automatic_emails")
      .select("delay_hours")
      .eq("trigger_key", "abandoned_cart")
      .maybeSingle();
    return data?.delay_hours && data.delay_hours > 0 ? data.delay_hours : 4;
  } catch {
    return 4;
  }
}
