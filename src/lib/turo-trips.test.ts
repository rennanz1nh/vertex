import { describe, it, expect, vi, beforeEach } from "vitest";

const pushes: [string, Record<string, unknown>][] = [];
vi.mock("@/lib/notify", () => ({ notifyPush: async (k: string, v: Record<string, unknown>) => { pushes.push([k, v]); } }));

import { upsertTrips, type TripRow } from "./turo-trips";

function fakeSupabase(existing: { turo_trip_id: string; status: string }[]) {
  return {
    from: () => ({
      select: () => ({ in: async (_k: string, ids: string[]) => ({ data: existing.filter((e) => ids.includes(e.turo_trip_id)) }) }),
      upsert: async () => ({ error: null }),
    }),
  } as never;
}

const future = new Date(Date.now() + 5 * 86_400_000).toISOString();
const later = new Date(Date.now() + 8 * 86_400_000).toISOString();
const past = new Date(Date.now() - 20 * 86_400_000).toISOString();

function trip(id: string, over: Partial<TripRow> = {}): TripRow {
  return {
    turo_trip_id: id, status: "BOOKED", guest_name: "John Smith", pickup_date: future, return_date: later,
    earnings_amount: null, earnings_currency: "USD", renter_id: null, product_id: null, raw_data: {}, updated_at: "",
    vehicle_make: "Hyundai", vehicle_model: "Elantra", vehicle_year: 2022, vehicle_id: "v", vehicle_vin: null,
    vehicle_license_plate: null, vehicle_type: null, vehicle_trim: null, vehicle_image_url: null,
    location_city: "", location_state: "", location_lat: null, location_lng: null, location_timezone: "America/New_York",
    ...over,
  };
}

beforeEach(() => { pushes.length = 0; });

describe("Turo trip announcements", () => {
  it("announces a new upcoming trip", async () => {
    await upsertTrips(fakeSupabase([]), [trip("t1")]);
    expect(pushes).toHaveLength(1);
    expect(pushes[0][0]).toBe("turo_new_trip");
    expect(pushes[0][1]).toMatchObject({ car: "2022 Hyundai Elantra", guest: "John Smith" });
  });

  it("ignores trips already stored and past trips", async () => {
    await upsertTrips(fakeSupabase([{ turo_trip_id: "t1", status: "BOOKED" }]), [trip("t1"), trip("old", { pickup_date: past, return_date: past })]);
    expect(pushes).toHaveLength(0);
  });

  it("announces a cancellation once", async () => {
    await upsertTrips(fakeSupabase([{ turo_trip_id: "t1", status: "BOOKED" }]), [trip("t1", { status: "CANCELLED" })]);
    expect(pushes.map((p) => p[0])).toEqual(["turo_trip_cancelled"]);
    pushes.length = 0;
    await upsertTrips(fakeSupabase([{ turo_trip_id: "t1", status: "CANCELLED" }]), [trip("t1", { status: "CANCELLED" })]);
    expect(pushes).toHaveLength(0);
  });

  it("sends one summary on a big first import", async () => {
    await upsertTrips(fakeSupabase([]), ["a", "b", "c", "d", "e", "f"].map((id) => trip(id)));
    expect(pushes).toHaveLength(1);
    expect(pushes[0][1]).toMatchObject({ car: "6 viagens novas" });
  });
});
