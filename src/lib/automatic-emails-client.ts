import { authedFetch } from "@/lib/admin-fetch";

// Client-side helper for firing an order-status automatic email — never awaited/blocking
// for the caller, and never throws; a failed email must never surface as a UI error for
// what is, from the user's perspective, just a status update.
export function triggerAutomaticEmail(triggerKey: "order_shipped" | "order_delivered" | "order_cancelled", orderId: string) {
  authedFetch("/api/automatic-emails/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ triggerKey, orderId }),
  }).catch((err) => console.error(`triggerAutomaticEmail(${triggerKey}) failed`, err));
}
