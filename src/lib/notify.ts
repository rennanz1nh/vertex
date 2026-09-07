import { createClient } from "@supabase/supabase-js";
import type { PriceUpdateSummary } from "@/lib/ebay-price-update";
import type { PriceUpdateSummary as AmazonPriceUpdateSummary } from "@/lib/amazon-price-update";
import type { PriceUpdateSummary as TikTokShopPriceUpdateSummary } from "@/lib/tiktok-shop-price-update";
import type { FeedSyncSummary as GoogleShoppingSyncSummary } from "@/lib/google-shopping-feed";
import { getSiteSettings } from "@/lib/site-settings";
import { resolveSiteUrl } from "@/lib/seo";

export type PushTriggerKey =
  | "ebay_price_success"
  | "ebay_price_error"
  | "amazon_price_success"
  | "amazon_price_error"
  | "tiktok_price_success"
  | "tiktok_price_error"
  | "google_shopping_success"
  | "google_shopping_error"
  | "new_chat_message"
  | "new_visit"
  | "checkout_started"
  | "daily_report"
  | "ebay_offers_eligible"
  | "new_order";

type MasterSettings = { enabled: boolean; ntfy_topic: string | null };

const DEFAULT_MASTER: MasterSettings = { enabled: true, ntfy_topic: null };

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } });
}

async function getMasterSettings(): Promise<MasterSettings> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from("notification_settings").select("enabled, ntfy_topic").limit(1).maybeSingle();
    if (!data) return DEFAULT_MASTER;
    return { enabled: data.enabled ?? DEFAULT_MASTER.enabled, ntfy_topic: data.ntfy_topic ?? null };
  } catch {
    return DEFAULT_MASTER;
  }
}

type PushTemplate = { enabled: boolean; title: string; message: string; tags: string[] };

async function getPushTemplate(triggerKey: PushTriggerKey): Promise<PushTemplate | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("push_notifications")
      .select("enabled, title, message, tags")
      .eq("trigger_key", triggerKey)
      .maybeSingle();
    if (!data) return null;
    return {
      enabled: data.enabled,
      title: data.title,
      message: data.message,
      tags: (data.tags ?? "").split(",").map((t: string) => t.trim()).filter(Boolean),
    };
  } catch {
    return null;
  }
}

function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

// Defends against a topic saved (or set via the NTFY_TOPIC env var) with a pasted-in
// protocol/domain/slashes — e.g. "https://ntfy.sh/my-topic" — which would otherwise
// silently double up into a broken "https://ntfy.sh/https://ntfy.sh/my-topic" URL.
function normalizeNtfyTopic(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^ntfy\.sh\//i, "")
    .replace(/^\/+|\/+$/g, "");
}

/**
 * Sends a push notification via ntfy.sh's JSON publish endpoint (POST https://ntfy.sh
 * with {topic, title, message, ...} in the body) rather than the header-based form —
 * the header-based form only accepts Latin-1 (fetch's Headers is a ByteString), which
 * throws the moment a title/message contains an emoji (e.g. "📊 Resumo diário..."). The
 * JSON body has no such restriction. No-ops silently if no topic is configured (DB or
 * NTFY_TOPIC env fallback), and never throws — a failed notification must not fail the
 * run itself.
 */
async function sendNtfy(rawTopic: string, opts: { title: string; message: string; priority?: "default" | "high"; tags?: string[]; click?: string }) {
  const topic = normalizeNtfyTopic(rawTopic);
  try {
    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        title: opts.title,
        message: opts.message,
        priority: opts.priority === "high" ? 4 : 3,
        ...(opts.tags?.length ? { tags: opts.tags } : {}),
        ...(opts.click ? { click: opts.click } : {}),
      }),
    });
    return res.ok ? { ok: true as const } : { ok: false as const, error: `ntfy.sh respondeu ${res.status}` };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Falha de rede ao enviar notificação" };
  }
}

// Where tapping the notification should land, for every trigger that doesn't build its
// own dynamic link (new_chat_message links to the specific conversation, new_visit to
// the page that was actually visited, daily_report to that day's report — those pass
// their own `click` and skip this map). Used both for real sends and for the "Enviar
// teste" button, so every notification always opens somewhere useful.
const DEFAULT_DESTINATIONS: Partial<Record<PushTriggerKey, string>> = {
  ebay_price_success: "/admin/automations/ebay/price",
  ebay_price_error: "/admin/automations/ebay/price",
  amazon_price_success: "/admin/automations/amazon/price",
  amazon_price_error: "/admin/automations/amazon/price",
  tiktok_price_success: "/admin/automations/tiktok-shop/price",
  tiktok_price_error: "/admin/automations/tiktok-shop/price",
  google_shopping_success: "/admin/automations/google-shopping/sync",
  google_shopping_error: "/admin/automations/google-shopping/sync",
  new_chat_message: "/admin/chat",
  new_visit: "/",
  checkout_started: "/admin/orders",
  daily_report: "/admin/reports/daily",
  ebay_offers_eligible: "/admin/automations/ebay/send-offer",
  new_order: "/admin",
};

async function adminUrl(path: string): Promise<string> {
  const settings = await getSiteSettings();
  return `${resolveSiteUrl(settings)}${path}`;
}

/**
 * Looks up the master switch/topic plus this trigger's own enabled flag and
 * title/message template, and sends the push if everything is on. Every notifyX
 * function below is a thin wrapper around this with trigger-specific vars.
 */
async function sendTriggeredPush(
  triggerKey: PushTriggerKey,
  vars: Record<string, string | number>,
  opts?: { priority?: "high"; click?: string }
) {
  const [master, template] = await Promise.all([getMasterSettings(), getPushTemplate(triggerKey)]);
  const topic = master.ntfy_topic || process.env.NTFY_TOPIC;
  if (!master.enabled || !topic || !template || !template.enabled) return;

  const defaultPath = DEFAULT_DESTINATIONS[triggerKey];
  const click = opts?.click ?? (defaultPath ? await adminUrl(defaultPath) : undefined);

  await sendNtfy(topic, {
    title: render(template.title, vars),
    message: render(template.message, vars),
    tags: template.tags,
    priority: opts?.priority,
    click,
  });
}

function triggerLabel(trigger: "manual" | "scheduled") {
  return trigger === "scheduled" ? "automática" : "manual";
}

function modeLabel(mode: "test" | "full" | "select") {
  return mode === "test" ? "teste" : mode === "select" ? "seleção" : "todos";
}

export async function notifyPriceAutomationSuccess(
  summary: PriceUpdateSummary,
  trigger: "manual" | "scheduled",
  mode: "test" | "full" | "select"
) {
  await sendTriggeredPush("ebay_price_success", { trigger: triggerLabel(trigger), mode: modeLabel(mode), updated: summary.updated, total: summary.total });
}

export async function notifyPriceAutomationError(
  error: string,
  trigger: "manual" | "scheduled",
  mode: "test" | "full" | "select"
) {
  await sendTriggeredPush("ebay_price_error", { trigger: triggerLabel(trigger), mode: modeLabel(mode), error }, { priority: "high" });
}

export async function notifyAmazonPriceAutomationSuccess(
  summary: AmazonPriceUpdateSummary,
  trigger: "manual" | "scheduled",
  mode: "test" | "full" | "select"
) {
  await sendTriggeredPush("amazon_price_success", { trigger: triggerLabel(trigger), mode: modeLabel(mode), updated: summary.updated, total: summary.total });
}

export async function notifyAmazonPriceAutomationError(
  error: string,
  trigger: "manual" | "scheduled",
  mode: "test" | "full" | "select"
) {
  await sendTriggeredPush("amazon_price_error", { trigger: triggerLabel(trigger), mode: modeLabel(mode), error }, { priority: "high" });
}

export async function notifyTikTokShopPriceAutomationSuccess(
  summary: TikTokShopPriceUpdateSummary,
  trigger: "manual" | "scheduled",
  mode: "test" | "full" | "select"
) {
  await sendTriggeredPush("tiktok_price_success", { trigger: triggerLabel(trigger), mode: modeLabel(mode), updated: summary.updated, total: summary.total });
}

export async function notifyTikTokShopPriceAutomationError(
  error: string,
  trigger: "manual" | "scheduled",
  mode: "test" | "full" | "select"
) {
  await sendTriggeredPush("tiktok_price_error", { trigger: triggerLabel(trigger), mode: modeLabel(mode), error }, { priority: "high" });
}

/** Unlike the eBay/Amazon variants this isn't a "price updated" alert — it's a feed
 *  sync (title/price/stock/availability mirrored to Google), so the default copy says
 *  "produtos sincronizados" rather than "preços atualizados". */
export async function notifyGoogleShoppingSyncSuccess(
  summary: GoogleShoppingSyncSummary,
  trigger: "manual" | "scheduled",
  mode: "test" | "full" | "select"
) {
  await sendTriggeredPush("google_shopping_success", { trigger: triggerLabel(trigger), mode: modeLabel(mode), synced: summary.synced, total: summary.total });
}

export async function notifyGoogleShoppingSyncError(
  error: string,
  trigger: "manual" | "scheduled",
  mode: "test" | "full" | "select"
) {
  await sendTriggeredPush("google_shopping_error", { trigger: triggerLabel(trigger), mode: modeLabel(mode), error }, { priority: "high" });
}

/**
 * Sends a push notification when a visitor sends a chat message.
 */
export async function notifyNewChatMessage(opts: {
  conversationId: string;
  visitorName?: string | null;
  preview: string;
  origin: string;
}) {
  const who = opts.visitorName?.trim() || "Visitante do site";
  await sendTriggeredPush(
    "new_chat_message",
    { who, preview: opts.preview.slice(0, 200) },
    { click: `${opts.origin}/admin/chat?c=${opts.conversationId}` }
  );
}

/** Shared shape for the Vercel geo headers read on both the visit-tracking and checkout routes. */
type VisitorGeo = { city?: string | null; region?: string | null; country?: string | null };

function locationLabel(geo: VisitorGeo): string {
  const parts = [geo.city, geo.region, geo.country].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.length > 0 ? parts.join(", ") : "Localização desconhecida";
}

/**
 * Sends a push notification when a visitor loads a store page, using Vercel's free
 * geo headers (no paid geolocation service) so we can show roughly where they are.
 */
export async function notifyNewVisit(opts: { path: string; origin: string } & VisitorGeo) {
  await sendTriggeredPush(
    "new_visit",
    { path: opts.path, location: locationLabel(opts) },
    { click: opts.origin ? `${opts.origin}${opts.path}` : undefined }
  );
}

/**
 * Sends a push notification when a Stripe Checkout session is created (cart → checkout).
 */
export async function notifyCheckoutStarted(opts: { total: number } & VisitorGeo) {
  const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(opts.total);
  await sendTriggeredPush("checkout_started", { amount, location: locationLabel(opts) });
}

/**
 * Sends the push that links to the daily report page once it's generated (see
 * /api/cron/daily-report).
 */
export async function notifyDailyReport(opts: { revenue: string; sessions: number; origin: string; reportDate: string }) {
  await sendTriggeredPush(
    "daily_report",
    { revenue: opts.revenue, sessions: opts.sessions },
    { click: `${opts.origin}/admin/reports/daily?date=${opts.reportDate}` }
  );
}

/**
 * Sends the push that tells you new eBay listings became eligible for an offer (see
 * /api/cron/ebay-eligible-offers).
 */
export async function notifyEbayOffersEligible(count: number) {
  await sendTriggeredPush("ebay_offers_eligible", { count });
}

/**
 * Used by the "Enviar teste" button on each notification row in Settings — bypasses
 * the enabled flags (both master and per-trigger) so setup can be verified before
 * turning things on. Accepts unsaved form values as an override so the test reflects
 * what's currently typed, not just what was last saved. `vars` are sample values used
 * to render the {placeholder} template for the preview.
 */
export async function sendTestPushNotification(
  triggerKey: PushTriggerKey,
  vars: Record<string, string | number>,
  override: { ntfy_topic?: string | null; title?: string; message?: string; tags?: string[] } = {}
): Promise<{ ok: boolean; error?: string }> {
  const master = await getMasterSettings();
  const topic = override.ntfy_topic || master.ntfy_topic || process.env.NTFY_TOPIC;
  if (!topic) return { ok: false, error: "Nenhum tópico ntfy configurado (nem nas configurações, nem na variável NTFY_TOPIC)." };

  const template = override.title && override.message ? { title: override.title, message: override.message, tags: override.tags ?? [] } : await getPushTemplate(triggerKey);
  if (!template) return { ok: false, error: "Modelo de notificação não encontrado." };

  const defaultPath = DEFAULT_DESTINATIONS[triggerKey];
  const click = defaultPath ? await adminUrl(defaultPath) : undefined;

  return sendNtfy(topic, {
    title: `[Teste] ${render(template.title, vars)}`,
    message: render(template.message, vars),
    tags: template.tags,
    click,
  });
}
