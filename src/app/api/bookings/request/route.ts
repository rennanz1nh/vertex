import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUnavailableCarIds, isValidDateRange } from "@/lib/car-availability";
import { getEffectivePrice } from "@/lib/pricing";
import { stripe } from "@/lib/stripe";
import {
  tripPriceBreakdown, ageFromDateOfBirth, MINIMUM_DRIVER_AGE, PROTECTION_PLANS, EXTRAS,
  type ProtectionPlanId, type ExtraId,
} from "@/lib/trip-pricing";
import { paymentPlan, toCents } from "@/lib/booking-payment-plan";
import { getOrCreateStripeCustomer, type PaymentKind } from "@/lib/booking-payments";

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
  rentalAgreementVersion: string;
};

const MAX_LICENSE_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_LICENSE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && /^[a-z0-9]+$/i.test(fromName)) return fromName.toLowerCase();
  return (file.type.split("/")[1] || "jpg").toLowerCase();
}

// Book & pay: creates the booking as pending_payment with a Stripe PaymentIntent for the
// deposit (20%, or 100% within 5 days of pickup) and returns its client secret; the page
// confirms the card and /api/bookings/[id]/finalize (or the webhook) confirms the booking.
// Since the storefront has no customer accounts, it also finds-or-creates the matching client
// record by email server-side (service role — the clients table holds PII like driver's
// license numbers, so it's never opened up to anon reads/writes directly).
//
// Submitted as multipart/form-data (not JSON) because it carries the front/back driver's
// license photos and the rental agreement signature alongside the booking fields — those
// get uploaded here, server-side, to private buckets (vertex-license-photos,
// vertex-rental-agreements), since anon never gets direct write access to a bucket holding
// photos of government IDs or signed legal documents.
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

  const signature = form.get("rentalAgreementSignature");
  if (!(signature instanceof File) || signature.size === 0) {
    return NextResponse.json({ error: "Please sign the rental agreement before submitting your request." }, { status: 400 });
  }

  const { carId, pickupDate, pickupTime, returnDate, returnTime, protectionPlan, extras, driver, breakdown, rentalAgreementVersion } = body;
  if (!carId || !pickupDate || !returnDate || !driver?.fullName?.trim() || !driver?.email?.trim() || !rentalAgreementVersion) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidDateRange(pickupDate, returnDate)) {
    return NextResponse.json({ error: "Please choose a valid pickup and return date." }, { status: 400 });
  }

  // Last check before anything is stored: the car may have been booked here or on Turo since
  // the customer opened the page (the listing filter only runs when they search by dates).
  const unavailable = await getUnavailableCarIds(pickupDate, returnDate);
  if (unavailable.has(carId)) {
    return NextResponse.json(
      { error: "Sorry, this car was just booked for some of these dates. Please choose other dates or another car." },
      { status: 409 },
    );
  }

  // Everything charged is recomputed here from the database; the browser's numbers are only
  // compared, so a stale or edited page can never set the price.
  const { data: car } = await supabaseAdmin
    .from("products")
    .select("id, name, make, model, year, daily_rate, discounted_daily_rate, min_driver_age, store_visible")
    .eq("id", carId)
    .maybeSingle();
  if (!car || !car.store_visible) {
    return NextResponse.json({ error: "This car is no longer available." }, { status: 409 });
  }
  const { price: dailyRate } = getEffectivePrice(car.daily_rate, car.discounted_daily_rate);
  if (dailyRate <= 0) {
    return NextResponse.json({ error: "This car is not available for online booking." }, { status: 409 });
  }
  const plan = PROTECTION_PLANS.find((p) => p.id === protectionPlan)?.id ?? null;
  const extraIds = (Array.isArray(extras) ? extras : []).filter((id): id is ExtraId => EXTRAS.some((e) => e.id === id));
  if (!driver.dateOfBirth) {
    return NextResponse.json({ error: "Please enter the driver's date of birth." }, { status: 400 });
  }
  const minAge = Math.max(MINIMUM_DRIVER_AGE, Number(car.min_driver_age) || MINIMUM_DRIVER_AGE);
  if (ageFromDateOfBirth(driver.dateOfBirth) < minAge) {
    return NextResponse.json({ error: `The driver must be at least ${minAge} years old for this car.` }, { status: 400 });
  }
  const priced = tripPriceBreakdown({
    carId, carName: "", carImage: null, dailyRate, minDriverAge: minAge,
    pickupDate, pickupTime, returnDate, returnTime,
    protectionPlan: plan as ProtectionPlanId | null, extras: extraIds,
    driver: { ...driver, dateOfBirth: driver.dateOfBirth },
  });
  if (Math.abs(toCents(priced.total) - toCents(Number(breakdown?.total ?? 0))) > 1) {
    return NextResponse.json(
      { error: "The price of this trip has changed. Please go back and review it before paying." },
      { status: 409 },
    );
  }
  const schedule = paymentPlan(priced.total, pickupDate);

  const email = driver.email.trim().toLowerCase();

  try {
    const uploadFolder = crypto.randomUUID();
    const [frontUpload, backUpload, signatureUpload] = await Promise.all([
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
      supabaseAdmin.storage
        .from("vertex-rental-agreements")
        .upload(`${uploadFolder}/signature.png`, await signature.arrayBuffer(), {
          contentType: "image/png",
        }),
    ]);
    if (frontUpload.error) throw frontUpload.error;
    if (backUpload.error) throw backUpload.error;
    if (signatureUpload.error) throw signatureUpload.error;
    const driverLicenseFrontPath = frontUpload.data.path;
    const driverLicenseBackPath = backUpload.data.path;
    const signaturePath = signatureUpload.data.path;

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

    const stripeCustomerId = await getOrCreateStripeCustomer(email, driver.fullName.trim(), driver.phone);

    // Created unpaid: it holds the dates while the customer pays and is released by the cron
    // if the payment never completes (see expireUnpaidCheckouts).
    const { data: booking, error: bookingError } = await supabaseAdmin.from("bookings").insert({
      car_id: carId,
      status: "pending_payment",
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      return_date: returnDate,
      return_time: returnTime,
      daily_rate: dailyRate,
      protection_plan: plan ?? "basic",
      extras: extraIds,
      driver_full_name: driver.fullName,
      driver_date_of_birth: driver.dateOfBirth,
      driver_license_number: driver.licenseNumber,
      driver_license_expiration: driver.licenseExpiration,
      driver_license_state: driver.licenseState,
      driver_license_front_path: driverLicenseFrontPath,
      driver_license_back_path: driverLicenseBackPath,
      rental_agreement_signed_at: new Date().toISOString(),
      rental_agreement_signature_path: signaturePath,
      rental_agreement_version: rentalAgreementVersion,
      trip_subtotal: priced.tripSubtotal,
      protection_total: priced.protectionTotal,
      extras_total: priced.extrasTotal,
      young_driver_fee_total: priced.youngDriverFeeTotal,
      estimated_total: priced.total,
      customer_name: driver.fullName,
      customer_email: email,
      payment_plan: schedule.plan,
      deposit_amount: schedule.depositAmount,
      balance_amount: schedule.balanceAmount,
      balance_due_date: schedule.balanceDueDate,
      stripe_customer_id: stripeCustomerId,
    }).select("id, payment_token").single();
    if (bookingError || !booking) throw bookingError ?? new Error("booking insert returned nothing");

    const carName = car.name || [car.year, car.make, car.model].filter(Boolean).join(" ") || "Vehicle";
    let clientSecret: string | null;
    try {
      const pi = await stripe.paymentIntents.create(
        {
          amount: toCents(schedule.depositAmount),
          currency: "usd",
          customer: stripeCustomerId,
          // Saved for the automatic 80% charge 5 days before pickup.
          setup_future_usage: "off_session",
          payment_method_types: ["card"],
          description: `${schedule.plan === "full" ? "Full payment" : "20% deposit"} · ${carName} · ${pickupDate} → ${returnDate}`,
          receipt_email: email,
          metadata: { booking_id: booking.id, kind: (schedule.plan === "full" ? "full" : "deposit") satisfies PaymentKind },
        },
        { idempotencyKey: `deposit-${booking.id}` },
      );
      clientSecret = pi.client_secret;
      await supabaseAdmin.from("bookings").update({ deposit_payment_intent_id: pi.id }).eq("id", booking.id);
    } catch (e) {
      await supabaseAdmin.from("bookings").update({ status: "cancelled", notes: "Falha ao iniciar o pagamento." }).eq("id", booking.id);
      throw e;
    }

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      token: booking.payment_token,
      clientSecret,
      schedule,
    });
  } catch (e) {
    console.error("Failed to create booking request:", e);
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 502 });
  }
}
