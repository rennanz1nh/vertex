// Downloads all product/site images from Wix CDN (user-owned content)
// into public/products and public/images, generating a name→path map.
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const products = [
  ["Sorali - Amino Keratin Instant Reconstruction and Hair Strengthening - 300ml", "e1c1cd_78fb2d3cbd75419ba4fd86ef61f34a4f~mv2.jpg"],
  ["Sorali - Therapy Liss - Single Step (Brazilian Keratin) Straight  1KG / 1Litter", "e1c1cd_c056b79060e04db1bf33cc7695873cae~mv2.jpg"],
  ["Sorali - Serum Oil Amino Plex - Hair Tip Repair no Friz 30ml", "e1c1cd_86bdc8a9c33b46d6b3153dd28ce8730d~mv2.jpg"],
  ["Sorali - Travel Kit (Shampoo + Conditioner  Termic Gloss + Serum + Bag)", "e1c1cd_ac099fa4fc974cec9ac3306b64c4c2c6~mv2.jpg"],
  ["Sorali - Termic Gloss / Leaving Just Sofistic for Daily Protection - 300ml", "e1c1cd_23f86a6e8acc4dea89a64a763b24123a~mv2.jpg"],
  ["Sorali - Amno Plex FULL KIT", "e1c1cd_37f3cba26c484513bced0316a6c936ed~mv2.jpg"],
  ["Sorali - Instant Hydration Mask - Just Sofistic (Spider Web) - 500gr", "e1c1cd_78b0b509a59a44798a77ff81b742abc1~mv2.jpg"],
  ["Sorali - Al-Kimiya Sorali - Biphasic Hair Schedule of Four Stages -  (Treatment)", "e1c1cd_1922a2cf46004c0e924e9a018ce852bd~mv2.jpg"],
  ["Sorali - Conditioner Amino For Daily Use Therapy Nutritive - 120ml", "e1c1cd_66670c398ba34be8af92a57c9b7ed79c~mv2.jpg"],
  ["Sorali - Argilo Detox - Full Kit", "e1c1cd_2f7dd2399c4c45529f96d3106c471ea1~mv2.jpg"],
  ["Hanna Lee - Ultimate Liss Progressive - Brazilian Keratin Streight Hair 1Kg", "e1c1cd_c72b3802d9dd4e7d82cc41717da6d1ca~mv2.png"],
  ["Sorali - Shampoo Amino For Daily Use Therapy Nutritive Moisturizing  - 120ml", "e1c1cd_5db0a73c6c944e33988b2a973d26107a~mv2.jpg"],
  ["Hanna Lee - Ultimate Repair (Serum) Oil Repair 30ml", "e1c1cd_63bdef79b9f04681997841c7bac72a4e~mv2.png"],
  ["Sorali Just Sofistic - Kit - Nutritive Smooth Cleaning Shampoo & Intense Repair", "e1c1cd_b88ab4479f91410db90f67d4744d60ef~mv2.webp"],
  ["Sorali - Conditioner For Dry Hair - Just Sofistic - 300ml", "e1c1cd_c2afbf923f3548638240883b6acd268a~mv2.jpg"],
  ["Sorali - PRÓ Luminous (Kit)", "e1c1cd_ebfe5fa4ffa548309b85dc3743af005b~mv2.jpg"],
  ["Sorali - Shampoo Pró Luminous - Matizing Ant-Yellow 300ML", "e1c1cd_278f8edb37ac4623a2c0261c222ea4ba~mv2.jpg"],
  ["Hanna Lee - Ultimate Liss Progressive - Brazilian Keratin Streight Hair 120g", "e1c1cd_19c5a86b4e594bc5bca4ea95770d029b~mv2.png"],
  ["Sorali - Conditioner for damaged hair - Amino Plex Thermal Protection Seal 300ml", "e1c1cd_449f60bcf64a4ca388f60c16c72e74cd~mv2.jpg"],
  ["Sorali - Just Sofistic KIT", "e1c1cd_07ce3e51d0434e3197fb923a0d03f3b6~mv2.jpg"],
  ["Sorali - Fluid Control Argilo Detox Complete Scalp & Skin Care - 60ML", "e1c1cd_afe0650e0cc34ae3a636538a99be0a37~mv2.jpg"],
  ["Sorali - Repairing Mask Daily Therapy Smoothing Maintenance - 240gr", "e1c1cd_b3a0b7d5260c4c1eb4507f611e204770~mv2.jpg"],
  ["Sorali - Repairing Mask - Just Sofistic Intense Revitalization-  950gr", "e1c1cd_2216850d58fd40c099d5f27f0f31d588~mv2.jpg"],
  ["Sorali - Argilo Detox Equilizer Conditioner - Clay Coconut Oil  300ml", "e1c1cd_0cc70b49d82749019a225c2b02d77714~mv2.jpg"],
  ["Sorali - Shampoo Dry Hair - Hydration And Deep Revitalization - 1L", "e1c1cd_869c5063089f42a28157bcf074a2dcb5~mv2.jpg"],
  ["Sorali - Selaplex No Frizz / Reduce Frizz Amino Plex Thermal Protect - 200ml", "e1c1cd_6155bd28fef14141835fc5ab7299999e~mv2.jpg"],
  ["Sorali - Shampoo Argilo Detox Clay Menthol Oiliness Control - 300ml", "e1c1cd_14f0e164a7b040dea61d8dd53ceb9ef0~mv2.jpg"],
  ["Sorali - Adstringent Detox Clay Green Zinc Oxide - 200GR", "e1c1cd_a6673434d9834fae9f01028c074b45ed~mv2.jpg"],
  ["Sorali - Shampoo for damaged hair - Amino Plex Thermal Protection Seal 300ml", "e1c1cd_7d8ac84fc4f84c92887c27a441158d5d~mv2.jpg"],
  ["Sorali - Silver Therapy Straight Hair Brazilian Keratin with Matization 120gr", "e1c1cd_a2bdfe4be467433fb091e99cec6f6d32~mv2.jpg"],
  ["Sorali - Conditioner Pró Luminous Tinting Mask Matizer Ant-Yellow - 300ML", "e1c1cd_84343f1379a54cd39ee18585a41b04aa~mv2.jpg"],
  ["Sorali - Pró Luminous - Mask Matizador (Anti Yellow) 300gr", "e1c1cd_41d4b868e1ec48ed81e8fa2714f5fb38~mv2.jpg"],
];

const siteImages = [
  ["hero-banner", "11062b_a9a337202fb047aeb6cf835c678752c7~mv2_d_6483_4862_s_4_2.jpg"],
  ["leaf-left", "e1c1cd_45eba0c8dd614c47adf73a08a3cb5ea9~mv2.png"],
  ["leaf-right", "e1c1cd_9c53095b1ebe448b97469136af11d6f9~mv2.png"],
  ["section-1", "11062b_e933441fee884d91a9022da30a0ea1b2~mv2.jpeg"],
  ["section-2", "11062b_939e40aad2fe40de9ab7e30610d2e265~mv2.jpg"],
  ["section-3", "11062b_e7f2db75b6154c2e8577260c5f787c19~mv2.jpg"],
  ["section-4", "11062b_7cd59621a58d4d62bd7d160ad77c6059~mv2.jpg"],
];

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function ext(id) {
  const m = id.match(/\.(\w+)$/);
  return m ? m[1] : "jpg";
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

const root = path.resolve(import.meta.dirname, "..");
const prodDir = path.join(root, "public", "products");
const imgDir = path.join(root, "public", "images");
await mkdir(prodDir, { recursive: true });
await mkdir(imgDir, { recursive: true });

const map = {};
let ok = 0, fail = 0;

for (const [name, id] of products) {
  const slug = slugify(name);
  const file = `${slug}.${ext(id)}`;
  try {
    const size = await download(`https://static.wixstatic.com/media/${id}`, path.join(prodDir, file));
    map[name] = `/products/${file}`;
    ok++;
    console.log(`OK  ${file} (${(size / 1024).toFixed(0)}kb)`);
  } catch (e) {
    fail++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

for (const [name, id] of siteImages) {
  const file = `${name}.${ext(id)}`;
  try {
    const size = await download(`https://static.wixstatic.com/media/${id}`, path.join(imgDir, file));
    ok++;
    console.log(`OK  images/${file} (${(size / 1024).toFixed(0)}kb)`);
  } catch (e) {
    fail++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

await writeFile(
  path.join(root, "src", "lib", "product-images.json"),
  JSON.stringify(map, null, 2)
);

console.log(`\nDone: ${ok} ok, ${fail} failed. Map written to src/lib/product-images.json`);
