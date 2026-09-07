// Downloads the two secondary promo banners shown after products on each
// category page in the Wix reference site.
import { mkdir, writeFile } from "fs/promises";
import path from "path";

const pairs = {
  women: ["11062b_7d236aed806f48b6ab70c24c537c5640~mv2.jpg", "e1c1cd_276be76548b24c1fbc076b6c3c9444f1~mv2.jpg"],
  "women-skin": ["11062b_1bebb25aea3241198fbc01d4d4dc85e9~mv2.jpg", "11062b_12c06c80bfa143f0867f7660affc3b70~mv2.jpg"],
  "women-body": ["11062b_e7f2db75b6154c2e8577260c5f787c19~mv2.jpg", "11062b_393aa39edcb44319b668318e88cd7119~mv2.jpg"],
  "women-hair": ["500250cd7292824ed977b4a047484c55.jpg", "e18374810154de9280d07fd5e80fb394.jpg"],
  professional: ["11062b_7b962c4db27f449d837541d6694f96fe~mv2.jpg", "11062b_1a83c965558647cbb5a081d4efa68747~mv2.jpg"],
  men: ["11062b_a610e64de8ab482980c37a7a286fb364~mv2.jpg", "11062b_047322f9aa044f8f9123053bf9a4bfe7~mv2.jpg"],
  clearance: ["11062b_a610e64de8ab482980c37a7a286fb364~mv2.jpg", "11062b_5c5bbbee57fc488f870a617271ac2d24~mv2.jpg"],
};

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "public", "banners", "secondary");
await mkdir(dir, { recursive: true });

let ok = 0, fail = 0;
for (const [slug, ids] of Object.entries(pairs)) {
  for (let i = 0; i < ids.length; i++) {
    const url = `https://static.wixstatic.com/media/${ids[i]}/v1/fill/w_960,h_528,al_c,q_82/b.jpg`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(path.join(dir, `${slug}-${i + 1}.jpg`), buf);
      ok++;
      console.log(`OK ${slug}-${i + 1}.jpg (${(buf.length / 1024).toFixed(0)}kb)`);
    } catch (e) {
      fail++;
      console.error(`FAIL ${slug}-${i + 1}: ${e.message}`);
    }
  }
}
console.log(`\n${ok} ok, ${fail} failed`);
