import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/brevo", () => ({ sendTransactionalEmail: vi.fn(), sendTransactionalSms: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notifyNewBooking: vi.fn() }));

import { buildAlertContent, parseEmails, parsePhones } from "./booking-alerts";
import type { BookingRecord } from "./booking-emails";

describe("recipient parsing", () => {
  it("parses and de-duplicates emails", () => {
    expect(parseEmails(" A@x.com, b@y.com; a@x.com bad-email ")).toEqual(["a@x.com", "b@y.com"]);
    expect(parseEmails(null)).toEqual([]);
  });

  it("normalizes US phones to digits with country code", () => {
    expect(parsePhones("+1 (407) 922-4078, 4075550100\n+55 11 91234-5678")).toEqual(["14079224078", "14075550100", "5511912345678"]);
    expect(parsePhones("123")).toEqual([]);
  });
});

describe("alert content", () => {
  const b = {
    id: "abcd1234-0000", car_id: "c", status: "confirmed",
    pickup_date: "2026-12-20", pickup_time: "10:00", return_date: "2026-12-23", return_time: "09:00",
    customer_email: "jane@example.com", customer_name: "Jane <Doe>", driver_full_name: null,
    estimated_total: 312, payment_plan: "deposit_balance", deposit_amount: 62.4, balance_amount: 249.6,
    balance_due_date: "2026-12-15", payment_token: "t", protection_plan: "standard", extras: [],
  } as BookingRecord;

  it("summarizes a 20% booking", () => {
    const c = buildAlertContent(b, "2020 Kia Rio", "+1 407 555 0100");
    expect(c.subject).toBe("Nova reserva: 2020 Kia Rio · Dec 20 → Dec 23 · $312.00");
    expect(c.sms).toContain("#ABCD1234");
    expect(c.sms).toContain("$62.40 pago (20%)");
    expect(c.html).toContain("Saldo de $249.60 será cobrado automaticamente");
    expect(c.html).toContain("Jane &lt;Doe&gt;"); // escaped
    expect(c.html).toContain("bloqueie estas datas no calendário da Turo");
  });

  it("summarizes a paid-in-full booking", () => {
    const c = buildAlertContent({ ...b, payment_plan: "full", deposit_amount: 312, balance_amount: 0, balance_due_date: null }, "2020 Kia Rio", null);
    expect(c.push.paid).toBe("$312.00 pago (100%)");
    expect(c.html).toContain("Pago integralmente.");
  });
});
