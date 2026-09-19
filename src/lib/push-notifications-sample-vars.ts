import type { PushTriggerKey } from "@/lib/notify";

/** Sample values used to render each push template's {placeholder}s for the "Ver exemplo" preview and "Enviar teste" button. */
export const PUSH_SAMPLE_VARS: Record<PushTriggerKey, Record<string, string | number>> = {
  ebay_price_success: { trigger: "manual", mode: "todos", updated: 98, total: 100 },
  ebay_price_error: { trigger: "automática", mode: "todos", error: "eBay token not found" },
  amazon_price_success: { trigger: "manual", mode: "todos", updated: 42, total: 45 },
  amazon_price_error: { trigger: "automática", mode: "todos", error: "Amazon SP-API rate limited" },
  tiktok_price_success: { trigger: "manual", mode: "todos", updated: 30, total: 30 },
  tiktok_price_error: { trigger: "automática", mode: "todos", error: "TikTok Shop token expired" },
  google_shopping_success: { trigger: "manual", mode: "todos", synced: 120, total: 120 },
  google_shopping_error: { trigger: "automática", mode: "todos", error: "Feed inválido" },
  new_chat_message: { who: "Visitante do site", preview: "Olá, o produto X ainda está disponível?" },
  new_visit: { path: "/products/tesla-model-3", location: "Miami, FL, US" },
  checkout_started: { amount: "$54.90", location: "Orlando, FL, US" },
  daily_report: { revenue: "$1,240.00", sessions: 312 },
  ebay_offers_eligible: { count: 3 },
  new_order: { canal: "eBay", total: "$49.90" },
};
