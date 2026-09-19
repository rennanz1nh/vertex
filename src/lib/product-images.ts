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

/** Resolves a local product image by exact product name match. */
export function getProductImage(productName: string | null): string | null {
  if (!productName) return null;
  const key = normalize(productName);
  return normalized[key] || null;
}
