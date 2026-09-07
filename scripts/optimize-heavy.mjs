// Re-downloads oversized images as web-optimized renditions from the Wix CDN.
import { writeFile } from "fs/promises";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");

const targets = [
  {
    id: "11062b_a9a337202fb047aeb6cf835c678752c7~mv2_d_6483_4862_s_4_2.jpg",
    out: "public/images/hero-banner.jpg",
    transform: "v1/fill/w_1920,h_1080,al_c,q_85/hero.jpg",
  },
  {
    id: "11062b_e933441fee884d91a9022da30a0ea1b2~mv2.jpeg",
    out: "public/images/section-1.jpeg",
    transform: "v1/fill/w_900,h_1200,al_c,q_85/skin.jpg",
  },
  {
    id: "11062b_e7f2db75b6154c2e8577260c5f787c19~mv2.jpg",
    out: "public/images/section-3.jpg",
    transform: "v1/fill/w_900,h_1200,al_c,q_85/body.jpg",
  },
  {
    id: "e1c1cd_c72b3802d9dd4e7d82cc41717da6d1ca~mv2.png",
    out: "public/products/hanna-lee-ultimate-liss-progressive-brazilian-keratin-streight-hair-1kg.png",
    transform: "v1/fit/w_1000,h_1000,q_90/p.png",
  },
  {
    id: "e1c1cd_63bdef79b9f04681997841c7bac72a4e~mv2.png",
    out: "public/products/hanna-lee-ultimate-repair-serum-oil-repair-30ml.png",
    transform: "v1/fit/w_1000,h_1000,q_90/p.png",
  },
];

for (const t of targets) {
  const url = `https://static.wixstatic.com/media/${t.id}/${t.transform}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`FAIL ${t.out}: ${res.status}`);
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(root, t.out), buf);
  console.log(`OK ${t.out} (${(buf.length / 1024).toFixed(0)}kb)`);
}
