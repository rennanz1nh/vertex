import imageMap from "./product-images.json";

const normalized: Record<string, string> = {};
for (const [name, path] of Object.entries(imageMap as Record<string, string>)) {
  normalized[normalize(name)] = path;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Resolves a local product image by product name; falls back to partial match. */
export function getProductImage(productName: string | null): string | null {
  if (!productName) return null;
  const key = normalize(productName);
  if (normalized[key]) return normalized[key];

  // partial match: one contains the other (handles small naming differences)
  for (const [k, path] of Object.entries(normalized)) {
    if (k.includes(key) || key.includes(k)) return path;
  }
  return null;
}
