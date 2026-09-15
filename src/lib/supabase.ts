import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });

// Public-safe view (no costs/margins). Created by supabase/setup-store-view.sql
export const STORE_PRODUCTS = "store_products";

// One row = one vehicle listing in the fleet.
export type Product = {
  id: string;
  name: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  vin: string | null;
  license_plate: string | null;
  mileage: number | null;
  transmission: string | null;
  fuel_type: string | null;
  seats: number | null;
  doors: number | null;
  pickup_city: string | null;
  min_driver_age: number;
  features: string[] | null;
  daily_rate: string | null;
  discounted_daily_rate: string | null;
  description: string | null;
  image_url: string | null;
  gallery_urls?: string[] | null;
  details?: { label: string; value: string }[] | null;
  store_visible?: boolean | null;
  store_categories?: string[] | null;
  ribbon_text?: string | null;
  ribbon_color?: string | null;
};
