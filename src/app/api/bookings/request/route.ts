import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RequestBody = {
  carId: string;
  pickupDate: string;
  pickupTime: string;
  returnDate: string;
  returnTime: string;
  dailyRate: number;
  protectionPlan: string;
  extras: string[];
  driver: {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    licenseNumber: string;
    licenseExpiration: string;
    licenseState: string;
  };
  breakdown: {
    tripSubtotal: number;
    protectionTotal: number;
    extrasTotal: number;
    youngDriverFeeTotal: number;
    total: number;
  };
};

// Request to Book: creates the booking (pending_payment — no Stripe wired up yet) and,
// since the storefront has no customer accounts, finds-or-creates the matching client
// record by email server-side (service role — the clients table holds PII like driver's
// license numbers, so it's never opened up to anon reads/writes directly).
export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { carId, pickupDate, pickupTime, returnDate, returnTime, dailyRate, protectionPlan, extras, driver, breakdown } = body;
  if (!carId || !pickupDate || !returnDate || !driver?.fullName?.trim() || !driver?.email?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const email = driver.email.trim().toLowerCase();

  try {
    const { data: existingClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingClient) {
      await supabaseAdmin
        .from("clients")
        .update({
          nome_razao: driver.fullName,
          telefone: driver.phone || undefined,
          date_of_birth: driver.dateOfBirth || undefined,
          license_number: driver.licenseNumber || undefined,
          license_state: driver.licenseState || undefined,
          license_expiration: driver.licenseExpiration || undefined,
        })
        .eq("id", existingClient.id);
    } else {
      await supabaseAdmin.from("clients").insert({
        nome_razao: driver.fullName,
        email,
        telefone: driver.phone || null,
        date_of_birth: driver.dateOfBirth || null,
        license_number: driver.licenseNumber || null,
        license_state: driver.licenseState || null,
        license_expiration: driver.licenseExpiration || null,
        tipo: "Individual",
        canal_principal: "Website",
      });
    }

    const { error: bookingError } = await supabaseAdmin.from("bookings").insert({
      car_id: carId,
      status: "pending_payment",
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      return_date: returnDate,
      return_time: returnTime,
      daily_rate: dailyRate,
      protection_plan: protectionPlan,
      extras,
      driver_full_name: driver.fullName,
      driver_date_of_birth: driver.dateOfBirth,
      driver_license_number: driver.licenseNumber,
      driver_license_expiration: driver.licenseExpiration,
      driver_license_state: driver.licenseState,
      trip_subtotal: breakdown.tripSubtotal,
      protection_total: breakdown.protectionTotal,
      extras_total: breakdown.extrasTotal,
      young_driver_fee_total: breakdown.youngDriverFeeTotal,
      estimated_total: breakdown.total,
      customer_name: driver.fullName,
      customer_email: email,
    });
    if (bookingError) throw bookingError;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Failed to create booking request:", e);
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 502 });
  }
}
