import { describe, it, expect } from "vitest";
import { buildGuests, milesFromReceipt, parseMoney, reimbursementsFromReceipt, type GuestTripInput } from "./turo-guests";

const now = new Date("2026-11-10T12:00:00Z");
const renter = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, firstName: name.split(" ")[0], lastName: name.split(" ")[1], url: `/us/en/drivers/${id}`,
  image: { originalImageUrl: `https://images.turo.com/${id}.jpg`, verified: true, placeholder: false, thumbnails: { "84x84": "small.jpg" } },
  ...extra,
});
function trip(id: string, renterId: number, name: string, over: Partial<GuestTripInput> = {}): GuestTripInput {
  return {
    id: `row-${id}`, turo_trip_id: id, renter_id: String(renterId), guest_name: name, status: "COMPLETED",
    pickup_date: "2026-09-01T14:00:00Z", return_date: "2026-09-04T14:00:00Z",
    vehicle_year: 2020, vehicle_make: "Kia", vehicle_model: "Rio", location_city: "Orlando",
    raw_data: { renter: renter(renterId, name) }, ...over,
  };
}

describe("buildGuests", () => {
  const guests = buildGuests(
    [
      trip("t1", 501, "Ann Lee"),
      trip("t2", 501, "Ann Lee", { pickup_date: "2026-10-10T14:00:00Z", return_date: "2026-10-12T14:00:00Z", vehicle_make: "Jeep", vehicle_model: "Wrangler", vehicle_year: 2023 }),
      trip("t3", 501, "Ann Lee", { status: "CANCELLED" }),
      trip("t4", 502, "Bob Ray", { status: "", pickup_date: "2026-12-01T14:00:00Z", return_date: "2026-12-03T14:00:00Z" }),
    ],
    [
      { reservation_id: "t1", trip_total: 300, host_earned: 240, data: { tripDistanceLineItems: [{ label: "Distance included", value: "750 mi" }, { label: "Miles driven", value: "312 mi" }], reimbursementTotalLineItem: { value: "$25.50" } } },
      { reservation_id: "t2", trip_total: "200.5", host_earned: "160", data: { tripDistanceLineItems: [{ label: "Miles driven", value: "1,050 mi" }, { label: "Excess miles", value: "50 mi" }] } },
    ],
    [
      { authorId: 501, overallRating: 5, text: "Great car", created: "2026-09-05T10:00:00Z", reservationId: "t1" },
      { authorId: 501, overallRating: 4, text: null, created: "2026-10-13T10:00:00Z", reservationId: "t2" },
    ],
    now,
  );
  const ann = guests.find((g) => g.renter_id === "501")!;
  const bob = guests.find((g) => g.renter_id === "502")!;

  it("groups by Turo renter id with profile and photo", () => {
    expect(guests).toHaveLength(2);
    expect(ann).toMatchObject({ name: "Ann Lee", first_name: "Ann", last_name: "Lee", profile_url: "https://turo.com/us/en/drivers/501", image_url: "https://images.turo.com/501.jpg", photo_verified: true });
  });

  it("counts trips, cancellations, days, spend, miles and reimbursements", () => {
    expect(ann).toMatchObject({ trips_count: 2, cancelled_count: 1, total_days: 5, total_spent: 500.5, host_earned: 400, miles_driven: 1362, reimbursements: 25.5 });
    expect(ann.first_trip_at).toBe("2026-09-01T14:00:00Z");
    expect(ann.last_trip_at).toBe("2026-10-10T14:00:00Z");
    expect(ann.cars).toEqual(["2020 Kia Rio", "2023 Jeep Wrangler"]);
    expect(ann.trips.map((t) => t.reservationId)).toEqual(["t2", "t1", "t3"]);
  });

  it("folds in the reviews the guest left", () => {
    expect(ann).toMatchObject({ reviews_count: 2, avg_rating: 4.5, last_review_text: "Great car" });
    expect(ann.reviews[0].at).toBe("2026-10-13T10:00:00.000Z");
  });

  it("marks upcoming trips and handles guests without receipts", () => {
    expect(bob).toMatchObject({ upcoming_count: 1, total_spent: 0, miles_driven: null, reviews_count: 0, avg_rating: null });
    expect(bob.trips[0].status).toBe("UPCOMING");
  });
});

describe("receipt helpers", () => {
  it("parses money, miles and reimbursements", () => {
    expect(parseMoney("- $35.93")).toBe(-35.93);
    expect(milesFromReceipt({ tripDistanceLineItems: [{ label: "Distance included", value: "600 mi" }, { label: "Miles driven", value: "742 mi" }] })).toBe(742);
    expect(milesFromReceipt({ tripDistanceLineItems: [{ label: "Distance included", value: "600 mi" }] })).toBeNull();
    expect(milesFromReceipt(null)).toBeNull();
    expect(reimbursementsFromReceipt({ reimbursementTotalLineItem: { value: "$40.00" } })).toBe(40);
    expect(reimbursementsFromReceipt({})).toBe(0);
  });
});
