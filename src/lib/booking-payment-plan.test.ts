import { describe, it, expect } from "vitest";
import { addDays, businessToday, depositAvailable, paymentPlan, paymentSummary } from "./booking-payment-plan";

describe("paymentPlan", () => {
  it("splits 20% now and 80% five days before pickup", () => {
    const p = paymentPlan(312, "2026-12-20", "2026-11-07");
    expect(p).toEqual({ plan: "deposit_balance", depositAmount: 62.4, balanceAmount: 249.6, balanceDueDate: "2026-12-15" });
  });

  it("deposit + balance always add up to the total to the cent", () => {
    for (const total of [99.99, 100.01, 333.33, 1234.57, 0.05]) {
      const p = paymentPlan(total, "2027-01-30", "2026-11-07");
      expect(Math.round((p.depositAmount + p.balanceAmount) * 100)).toBe(Math.round(total * 100));
    }
  });

  it("charges 100% when pickup is less than 5 days away", () => {
    expect(paymentPlan(200, "2026-11-11", "2026-11-07")).toEqual({ plan: "full", depositAmount: 200, balanceAmount: 0, balanceDueDate: null });
  });

  it("charges 100% when the due date would be today", () => {
    expect(paymentPlan(200, "2026-11-12", "2026-11-07").plan).toBe("full");
  });

  it("keeps the split when the due date is tomorrow", () => {
    expect(paymentPlan(200, "2026-11-13", "2026-11-07")).toMatchObject({ plan: "deposit_balance", balanceDueDate: "2026-11-08" });
  });
});

describe("pay in full option", () => {
  it("charges 100% now when the customer picks full, even far from pickup", () => {
    expect(paymentPlan(312, "2026-12-20", "2026-11-07", "full")).toEqual({ plan: "full", depositAmount: 312, balanceAmount: 0, balanceDueDate: null });
  });

  it("ignores a 20% choice inside the 5-day window", () => {
    expect(paymentPlan(200, "2026-11-10", "2026-11-07", "deposit").plan).toBe("full");
  });

  it("offers the 20% option only before the due date", () => {
    expect(depositAvailable("2026-11-13", "2026-11-07")).toBe(true);
    expect(depositAvailable("2026-11-12", "2026-11-07")).toBe(false);
  });
});

describe("dates", () => {
  it("addDays crosses months and years", () => {
    expect(addDays("2027-01-03", -5)).toBe("2026-12-29");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("businessToday uses New York time", () => {
    // 02:00 UTC on Nov 8 is still Nov 7 in New York.
    expect(businessToday(new Date("2026-11-08T02:00:00Z"))).toBe("2026-11-07");
  });
});

describe("paymentSummary", () => {
  it("describes the schedule", () => {
    expect(paymentSummary({ plan: "deposit_balance", depositAmount: 62.4, balanceAmount: 249.6, balanceDueDate: "2026-12-15" }))
      .toBe("Paid today: $62.40 (20% deposit). The remaining $249.60 will be charged automatically to the same card on Tue, Dec 15, 2026.");
    expect(paymentSummary({ plan: "full", depositAmount: 200, balanceAmount: 0, balanceDueDate: null })).toBe("Paid in full: $200.00.");
  });
});
