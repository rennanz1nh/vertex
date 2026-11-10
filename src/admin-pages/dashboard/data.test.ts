import { describe, it, expect } from "vitest";
import { buildRentals, summarize, carStats, monthly, customerSplit, byLength, compareWindow, presetRange, overlapDays, monthPace } from "./data";

const cars = [{ id: "c1", name: "2020 Kia Rio", make: "Kia", model: "Rio", year: 2020, image_url: null, store_visible: true, daily_rate: "50" }];
const rentals = buildRentals({
  cars,
  clients: [{ id: "cl1", nome_razao: "Chris W" }],
  trips: [
    { id: "t1", turo_trip_id: "r1", status: "COMPLETED", pickup_date: "2026-10-01T14:00:00Z", return_date: "2026-10-04T14:00:00Z", location_timezone: "America/New_York", product_id: "c1", vehicle_year: 2020, vehicle_make: "Kia", vehicle_model: "Rio", renter_id: "g1", guest_name: "Ann" },
    { id: "t2", turo_trip_id: "r2", status: "COMPLETED", pickup_date: "2026-10-20T14:00:00Z", return_date: "2026-10-22T14:00:00Z", location_timezone: "America/New_York", product_id: "c1", vehicle_year: 2020, vehicle_make: "Kia", vehicle_model: "Rio", renter_id: "g1", guest_name: "Ann" },
    { id: "t3", turo_trip_id: "r3", status: "CANCELLED", pickup_date: "2026-10-25T14:00:00Z", return_date: "2026-10-27T14:00:00Z", location_timezone: "America/New_York", product_id: "c1", vehicle_year: 2020, vehicle_make: "Kia", vehicle_model: "Rio", renter_id: "g2", guest_name: "Bob" },
  ],
  receipts: [
    { reservation_id: "r1", trip_total: 200, host_earned: 160, turo_fee: -40 },
    { reservation_id: "r2", trip_total: "120", host_earned: "100", turo_fee: "20" },
  ],
  bookings: [
    { id: "b1", car_id: "c1", status: "confirmed", pickup_date: "2026-10-10", return_date: "2026-10-12", estimated_total: 154, customer_email: "x@y.com", customer_name: "Xavier" },
    { id: "b2", car_id: "c1", status: "pending_payment", pickup_date: "2026-10-15", return_date: "2026-10-16", estimated_total: 50, customer_email: "z@y.com", customer_name: "Zed" },
  ],
  orders: [{ id: "o1", data_pedido: "2026-10-05", total: 110, status: "Pago", client_id: "cl1", canal: "Vertex Rental Cars" }],
});

describe("buildRentals", () => {
  it("unifies Turo, site and payment-link rentals (skipping unpaid checkouts)", () => {
    expect(rentals.map((r) => r.channel)).toEqual(["Turo", "Direto", "Site", "Turo", "Turo"]);
    const t1 = rentals.find((r) => r.id === "turo:t1")!;
    expect(t1).toMatchObject({ gross: 200, net: 160, fee: 40, days: 3, carLabel: "2020 Kia Rio", customerKey: "turo:g1" });
    expect(t1.start.getDate()).toBe(1);
    expect(rentals.find((r) => r.id === "site:b1")).toMatchObject({ gross: 154, net: 154, days: 2 });
    expect(rentals.find((r) => r.id === "direto:o1")).toMatchObject({ gross: 110, days: 0, customerName: "Chris W" });
  });
});

describe("summaries", () => {
  it("adds up gross, net, fees, days and rates (cancelled excluded)", () => {
    const s = summarize(rentals);
    expect(s).toMatchObject({ gross: 584, net: 524, fee: 60, trips: 4, days: 7, cancelled: 1 });
    expect(s.adr).toBeCloseTo(474 / 7); // payment links have no days, so they stay out of the daily rate
    expect(s.cancelRate).toBeCloseTo(0.2);
  });

  it("computes per-car occupancy inside the window", () => {
    const from = new Date(2026, 9, 1);
    const to = new Date(2026, 9, 31);
    const [kia] = carStats(rentals, cars, { from, to });
    expect(kia).toMatchObject({ label: "2020 Kia Rio", trips: 3, days: 7, gross: 474 });
    expect(kia.occupancy).toBeCloseTo(7 / 31);
  });

  it("counts only the rented days that fall inside the window", () => {
    const t1 = rentals.find((r) => r.id === "turo:t1")!;
    expect(overlapDays(t1, new Date(2026, 9, 3), new Date(2026, 9, 31))).toBe(1);
  });

  it("buckets by month and trip length", () => {
    const m = monthly(rentals, 2, new Date(2026, 10, 10));
    expect(m.map((p) => [p.key, p.trips, p.gross])).toEqual([["2026-10", 4, 584], ["2026-11", 0, 0]]);
    expect(byLength(rentals).map((b) => b.trips)).toEqual([0, 2, 1, 0, 0, 0]);
  });

  it("splits new and returning customers", () => {
    const window = rentals.filter((r) => r.start >= new Date(2026, 9, 15));
    const split = customerSplit(rentals, window, new Date(2026, 9, 15));
    expect(split).toMatchObject({ returning: 1, newCustomers: 0, returningGross: 120 });
    const all = customerSplit(rentals, rentals, null);
    expect(all.returning).toBe(1); // Ann rented twice
    expect(all.newCustomers).toBe(2); // Xavier, Chris
    expect(all.top[0]).toMatchObject({ name: "Ann", trips: 2, gross: 320 });
  });

  it("tracks the month's pace against last month", () => {
    const pace = monthPace(rentals, new Date(2026, 10, 10), (r) => r.gross);
    expect(pace.prevTotal).toBe(584);
    expect(pace.soFar).toBe(0);
  });
});

describe("periods", () => {
  it("compares with the previous window of the same length", () => {
    const today = new Date(2026, 10, 10);
    const r = presetRange("30d", today);
    const c = compareWindow("30d", r)!;
    expect(c.to.getDate()).toBe(11);
    expect(c.label).toBe("vs 30 dias anteriores");
    expect(compareWindow("all", presetRange("all", today))).toBeNull();
  });
});
