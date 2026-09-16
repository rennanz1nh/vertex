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

const MAX_LICENSE_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_LICENSE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && /^[a-z0-9]+$/i.test(fromName)) return fromName.toLowerCase();
  return (file.type.split("/")[1] || "jpg").toLowerCase();
}

// Request to Book: creates the booking (pending_payment — no Stripe wired up yet) and,
// since the storefront has no customer accounts, finds-or-creates the matching client
// record by email server-side (service role — the clients table holds PII like driver's
// license numbers, so it's never opened up to anon reads/writes directly).
//
// Submitted as multipart/form-data (not JSON) because it carries the front/back driver's
// license photos alongside the booking fields — those get uploaded here, server-side, to
// the private vertex-license-photos bucket, since anon never gets direct write access to
// a bucket holding photos of government IDs.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  let body: RequestBody;
  try {
    body = JSON.parse(String(form.get("payload") || ""));
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const licenseFront = form.get("licenseFront");
  const licenseBack = form.get("licenseBack");
  if (!(licenseFront instanceof File) || !(licenseBack instanceof File) || licenseFront.size === 0 || licenseBack.size === 0) {
    return NextResponse.json({ error: "Please upload photos of the front and back of the driver's license." }, { status: 400 });
  }
  for (const file of [licenseFront, licenseBack]) {
    if (!ALLOWED_LICENSE_PHOTO_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "License photos must be JPG, PNG, WEBP or HEIC images." }, { status: 400 });
    }
    if (file.size > MAX_LICENSE_PHOTO_BYTES) {
      return NextResponse.json({ error: "Each license photo must be smaller than 10MB." }, { status: 400 });
    }
  }

  const { carId, pickupDate, pickupTime, returnDate, returnTime, dailyRate, protectionPlan, extras, driver, breakdown } = body;
  if (!carId || !pickupDate || !returnDate || !driver?.fullName?.trim() || !driver?.email?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const email = driver.email.trim().toLowerCase();

  try {
    const uploadFolder = crypto.randomUUID();
    const [frontUpload, backUpload] = await Promise.all([
      supabaseAdmin.storage
        .from("vertex-license-photos")
        .upload(`${uploadFolder}/front.${extensionFor(licenseFront)}`, await licenseFront.arrayBuffer(), {
          contentType: licenseFront.type,
        }),
      supabaseAdmin.storage
        .from("vertex-license-photos")
        .upload(`${uploadFolder}/back.${extensionFor(licenseBack)}`, await licenseBack.arrayBuffer(), {
          contentType: licenseBack.type,
        }),
    ]);
    if (frontUpload.error) throw frontUpload.error;
    if (backUpload.error) throw backUpload.error;
    const driverLicenseFrontPath = frontUpload.data.path;
    const driverLicenseBackPath = backUpload.data.path;

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
      driver_license_front_path: driverLicenseFrontPath,
      driver_license_back_path: driverLicenseBackPath,
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
