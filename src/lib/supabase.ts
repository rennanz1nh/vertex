import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });

// Public-safe view (no costs/margins). Created by supabase/setup-store-view.sql
export const STORE_PRODUCTS = "store_products";

export type Product = {
  id: string;
  "Produto Nome": string | null;
  "Informacoes dos produtos / descricao": string | null;
  "Valor de venda (Online)": string | null;
  "Quantidade no Estoque": string | null;
  Marca: string | null;
  "Linha do produto": string | null;
  SKU: string | null;
  Volume: string | null;
  image_url: string | null;
  gallery_urls?: string[] | null;
  details?: { label: string; value: string }[] | null;
  store_visible?: boolean | null;
  store_category?: string | null;
  store_categories?: string[] | null;
  ribbon_text?: string | null;
  ribbon_color?: string | null;
  sale_price?: string | null;
};
