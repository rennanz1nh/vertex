// Shared Shippo types/storage helpers — used by both the "Comprar Etiqueta" column on the
// Shipping's admin page (src/admin-pages/OrdersTest.tsx) and the "Buy Label" flow inside the
// order edit dialog (src/components/OrderForm.tsx), which both render the same
// <BuyLabelDialog> (src/components/shipping/BuyLabelDialog.tsx).

export const BOX_KEY = "shippo.boxPresets.v1";

export type BoxPreset = {
  id: string; name: string;
  length: string; width: string; height: string;
  distance_unit: "in" | "cm";
  unit_count?: string;
  image?: string;
};

export type Rate = { object_id: string; carrier: string; service: string; days: number | null; amount: string; currency: string };

export type OrphanTx = {
  tracking_number: string; carrier: string | null; service: string | null;
  amount: string | null; currency: string | null; created: string | null;
  address_to: { name: string | null; city: string | null; country: string | null; zip: string | null } | null;
};

export type LabelResult = { label_url: string; tracking_number: string; tracking_url: string; carrier: string; service: string };

export type ShippoTx = {
  object_id: string;
  tracking_number: string;
  label_url: string | null;
  commercial_invoice_url: string | null;
  tracking_url_provider: string | null;
  status: string;
  carrier: string | null;
  service: string | null;
  amount: string | null;
  currency: string | null;
  created: string | null;
};

const DEFAULT_BOXES: BoxPreset[] = [
  { id: "d1", name: "Pequena (12×8×4 in)",  length: "12", width: "8",  height: "4",  distance_unit: "in" },
  { id: "d2", name: "Média (16×12×6 in)",    length: "16", width: "12", height: "6",  distance_unit: "in" },
  { id: "d3", name: "Grande (20×16×10 in)",  length: "20", width: "16", height: "10", distance_unit: "in" },
];

const MIGRATED_KEY = "shippo.boxPresets.migratedToDb.v1";

// Boxes now live in the DB (table box_presets) so they're shared across devices and
// between dev/prod. On first load per browser, any presets still sitting in the old
// localStorage are pushed up to the DB one time, then localStorage stops being the
// source of truth. authedFetch is passed in by the caller to avoid a circular import.
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export async function loadBoxes(fetcher: Fetcher): Promise<BoxPreset[]> {
  // One-shot migration: if this browser still has localStorage boxes and hasn't migrated,
  // seed the DB with them. The flag is set BEFORE the async save so two pages loading at
  // once (e.g. Pedidos + Shipping) can't both migrate — otherwise their saves interleave
  // and duplicate every box. The server seed is guarded with onlyIfEmpty for the same reason.
  try {
    if (!localStorage.getItem(MIGRATED_KEY)) {
      localStorage.setItem(MIGRATED_KEY, "1");
      const legacy = localStorage.getItem(BOX_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as BoxPreset[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          await seedBoxesIfEmpty(fetcher, parsed);
        }
      }
    }
  } catch { /* best-effort migration; fall through to DB read */ }

  try {
    const res = await fetcher("/api/boxes");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.boxes)) {
        // Empty DB (fresh install, no legacy) → seed defaults so the UI isn't blank.
        // onlyIfEmpty makes concurrent loads race-safe: the server inserts once.
        if (data.boxes.length === 0) {
          await seedBoxesIfEmpty(fetcher, DEFAULT_BOXES);
          const retry = await fetcher("/api/boxes");
          if (retry.ok) {
            const retryData = await retry.json();
            if (Array.isArray(retryData.boxes) && retryData.boxes.length > 0) return retryData.boxes;
          }
          return DEFAULT_BOXES;
        }
        return data.boxes;
      }
    }
  } catch { /* network error — fall back to defaults below */ }

  return DEFAULT_BOXES;
}

// Seeds boxes only if the table is currently empty (server-enforced), so two browsers/tabs
// racing to migrate or seed defaults can't both insert.
async function seedBoxesIfEmpty(fetcher: Fetcher, b: BoxPreset[]): Promise<void> {
  await fetcher("/api/boxes", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boxes: b, onlyIfEmpty: true }),
  });
}

export async function saveBoxes(fetcher: Fetcher, b: BoxPreset[]): Promise<void> {
  await fetcher("/api/boxes", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ boxes: b }),
  });
}
