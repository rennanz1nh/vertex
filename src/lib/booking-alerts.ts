// Tells the business about every booking paid on the site: an email to each alert address,
// an SMS to each alert phone (when SMS is switched on) and an ntfy push. Called once per
// booking, by whichever confirmation path flips it to confirmed (see applyDepositSucceeded).
// Never throws: an alert failing must not affect the customer's booking.
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendTransactionalEmail, sendTransactionalSms } from "@/lib/brevo";
import { htmlToPlainText } from "@/lib/automatic-emails";
import { notifyNewBooking } from "@/lib/notify";
import { MASTER_ADMIN_EMAIL } from "@/lib/master-admin";
import { PROTECTION_PLANS, EXTRAS, tripDays, type ExtraId, type ProtectionPlanId } from "@/lib/trip-pricing";
import { formatLongDate, formatUsd, shortRange } from "@/lib/booking-payment-plan";
import { carNameFor, siteUrl, type BookingRecord } from "@/lib/booking-emails";

export type AlertSettings = {
  emails: string[];
  phones: string[];
  smsEnabled: boolean;
  smsSender: string;
};

export type AlertResult = { channel: "email" | "sms" | "push"; to: string; ok: boolean; error?: string };

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function parseEmails(raw: string | null | undefined): string[] {
  return [...new Set((raw ?? "").split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))];
}

/** "+1 (407) 922-4078, 4075551234" → ["14079224078", "14075551234"]. 10-digit numbers get the US "1". */
export function parsePhones(raw: string | null | undefined): string[] {
  const out = (raw ?? "")
    .split(/[,;\n]+/)
    .map((p) => p.replace(/\D/g, ""))
    .map((d) => (d.length === 10 ? `1${d}` : d))
    .filter((d) => d.length >= 11 && d.length <= 15);
  return [...new Set(out)];
}

export async function getAlertSettings(): Promise<AlertSettings> {
  const [{ data: n }, { data: site }] = await Promise.all([
    supabaseAdmin.from("notification_settings").select("*").limit(1).maybeSingle(),
    supabaseAdmin.from("site_settings").select("business_email, business_phone, whatsapp_number").limit(1).maybeSingle(),
  ]);
  const emails = parseEmails(n?.booking_alert_emails);
  const phones = parsePhones(n?.booking_alert_phones);
  return {
    emails: emails.length ? emails : parseEmails(site?.business_email || MASTER_ADMIN_EMAIL),
    phones: phones.length ? phones : parsePhones(site?.business_phone || site?.whatsapp_number),
    smsEnabled: !!n?.booking_alert_sms_enabled,
    smsSender: (n?.booking_alert_sms_sender || "Vertex").slice(0, 15),
  };
}

type AlertContent = {
  subject: string;
  html: string;
  sms: string;
  push: { car: string; customer: string; dates: string; paid: string; total: string };
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildAlertContent(b: BookingRecord, carName: string, customerPhone: string | null): AlertContent {
  const customer = b.customer_name || b.driver_full_name || b.customer_email || "Cliente";
  const total = Number(b.estimated_total);
  const paid = Number(b.deposit_amount ?? total);
  const isFull = b.payment_plan !== "deposit_balance";
  const confirmation = b.id.slice(0, 8).toUpperCase();
  const dates = shortRange(b.pickup_date, b.return_date);
  const paidLabel = isFull ? `${formatUsd(paid)} pago (100%)` : `${formatUsd(paid)} pago (20%)`;
  const plan = PROTECTION_PLANS.find((p) => p.id === (b.protection_plan as ProtectionPlanId))?.name ?? String(b.protection_plan ?? "—");
  const extras = (Array.isArray(b.extras) ? (b.extras as ExtraId[]) : []).map((id) => EXTRAS.find((e) => e.id === id)?.name).filter(Boolean).join(", ") || "Nenhum";
  const days = tripDays({ pickupDate: b.pickup_date, returnDate: b.return_date });
  const balanceLine = isFull
    ? "Pago integralmente."
    : `Saldo de ${formatUsd(Number(b.balance_amount ?? 0))} será cobrado automaticamente em ${b.balance_due_date ? formatLongDate(b.balance_due_date) : "—"}.`;
  const adminLink = `${siteUrl()}/admin/bookings`;

  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;white-space:nowrap">${k}</td><td style="padding:6px 0;color:#111827">${esc(v)}</td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h1 style="font-size:20px;color:#111827;margin:0 0 4px">Nova reserva pelo site</h1>
  <p style="margin:0 0 16px;color:#6b7280">#${confirmation} · ${esc(carName)}</p>
  <table style="border-collapse:collapse;font-size:14px;width:100%">
    ${row("Carro", carName)}
    ${row("Retirada", `${formatLongDate(b.pickup_date)} às ${b.pickup_time}`)}
    ${row("Devolução", `${formatLongDate(b.return_date)} às ${b.return_time}`)}
    ${row("Dias", String(days))}
    ${row("Cliente", customer)}
    ${row("E-mail", b.customer_email || "—")}
    ${row("Telefone", customerPhone || "—")}
    ${row("Proteção", plan)}
    ${row("Extras", extras)}
    ${row("Total", formatUsd(total))}
    ${row("Pago agora", paidLabel)}
    ${row("Saldo", balanceLine)}
  </table>
  <p style="margin:20px 0;padding:12px;background:#fef3c7;border-radius:6px;font-size:14px"><strong>Lembrete:</strong> bloqueie estas datas no calendário da Turo e marque como bloqueado em Reservas.</p>
  <p style="margin:24px 0"><a href="${adminLink}" style="background:#111827;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">Abrir Reservas</a></p>
</div>`;

  const sms = `Vertex: nova reserva #${confirmation}. ${carName}, ${dates}. ${customer}${customerPhone ? ` ${customerPhone}` : ""}. Total ${formatUsd(total)}, ${paidLabel}. Bloquear na Turo.`;

  return {
    subject: `Nova reserva: ${carName} · ${dates} · ${formatUsd(total)}`,
    html,
    sms,
    push: { car: carName, customer, dates, paid: paidLabel, total: formatUsd(total) },
  };
}

async function customerPhoneFor(email: string | null): Promise<string | null> {
  if (!email) return null;
  const { data } = await supabaseAdmin.from("clients").select("telefone").eq("email", email).maybeSingle();
  return (data?.telefone as string | null) || null;
}

async function deliver(content: AlertContent, settings: AlertSettings, { skipPush = false } = {}): Promise<AlertResult[]> {
  const results: AlertResult[] = [];
  await Promise.all([
    ...settings.emails.map(async (to) => {
      try {
        await sendTransactionalEmail({ to: [{ email: to }], subject: content.subject, htmlContent: content.html, textContent: htmlToPlainText(content.html) });
        results.push({ channel: "email", to, ok: true });
      } catch (e) {
        results.push({ channel: "email", to, ok: false, error: (e as Error).message });
      }
    }),
    ...(settings.smsEnabled
      ? settings.phones.map(async (to) => {
          try {
            await sendTransactionalSms({ sender: settings.smsSender, recipient: to, content: content.sms });
            results.push({ channel: "sms", to, ok: true });
          } catch (e) {
            results.push({ channel: "sms", to, ok: false, error: (e as Error).message });
          }
        })
      : []),
    skipPush
      ? Promise.resolve()
      : notifyNewBooking(content.push).then(
          () => { results.push({ channel: "push", to: "ntfy", ok: true }); },
          (e) => { results.push({ channel: "push", to: "ntfy", ok: false, error: (e as Error).message }); },
        ),
  ]);
  return results;
}

/** Email + SMS + push to the business for a booking that was just paid. */
export async function sendBookingAlerts(b: BookingRecord): Promise<AlertResult[]> {
  try {
    const [carName, phone, settings] = await Promise.all([carNameFor(b.car_id), customerPhoneFor(b.customer_email), getAlertSettings()]);
    const results = await deliver(buildAlertContent(b, carName, phone), settings);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) console.error("booking alerts: some deliveries failed", b.id, failed);
    return results;
  } catch (e) {
    console.error("sendBookingAlerts failed", b.id, e);
    return [];
  }
}

/** "Enviar teste" in the admin: the same email/SMS with sample booking data. */
export async function sendTestBookingAlert(): Promise<AlertResult[]> {
  const settings = await getAlertSettings();
  const sample = {
    id: "TEST0000-0000", car_id: "", status: "confirmed",
    pickup_date: "2026-12-20", pickup_time: "10:00", return_date: "2026-12-23", return_time: "10:00",
    customer_email: "jane@example.com", customer_name: "Jane Doe (TESTE)", driver_full_name: null,
    estimated_total: 312, payment_plan: "deposit_balance", deposit_amount: 62.4, balance_amount: 249.6,
    balance_due_date: "2026-12-15", payment_token: "", protection_plan: "standard", extras: ["unlimited_mileage"],
  } as BookingRecord;
  const content = buildAlertContent(sample, "2020 Kia Rio", "+1 407 555 0100");
  content.subject = `[TESTE] ${content.subject}`;
  return deliver(content, settings, { skipPush: true });
}
