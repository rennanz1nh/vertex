// Downloads per-page banners from the Wix CDN (user-owned content), baking in
// the exact focal point (fp) and aspect ratio the Wix site uses so CSS only
// needs object-cover/center to match the original framing.
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// slug -> { id, fp:[x,y], ratio }  (ratio = width/height of the banner box)
const banners = {
  women: { id: "b294fecde9ac443f89200e91659f7137.jpg", fp: [0.76, 0.41], ratio: 6.55 },
  "women-skin": { id: "11062b_f196610abc50471f94663e45181ff166~mv2.jpg", fp: [0.01, 0.24], ratio: 4.1 },
  "women-body": { id: "11062b_cb61990bdea54d64a0ee8063b92348b6~mv2.jpg", fp: [0.51, 0.54], ratio: 6.55 },
  "women-hair": { id: "d56f5abe125541968c589a2b9d6b7fef.jpg", fp: [0.5, 0.5], ratio: 6.55 },
  professional: { id: "5eb3c2061b8541d68e3c49353d2f1632.jpg", fp: [0.5, 0.5], ratio: 6.55 },
  men: { id: "11062b_3abd360da6494eaaa7b40c159cf2ca03~mv2.jpg", fp: [0.55, 0.22], ratio: 6.55 },
  clearance: { id: "11062b_2a21543d073044d3bb407f6818a6151f~mv2.jpg", fp: [0.5, 0.5], ratio: 6.55 },
  "contact-us": { id: "11062b_2d61e9ab3fb54b7fad58f8182202c871~mv2.jpg", fp: [0.67, 0.35], ratio: 6.39 },
  "sell-with-us": { id: "cf4179cd422642b4b1eec0b7d3c11069.png", fp: [0.45, 0.14], ratio: 6.55 },
  courses: { id: "11062b_60c6587baab24abeb7a03f9d60bded37~mv2.jpg", fp: [0.5, 0.5], ratio: 6.55 },
};

const W = 1920; // download width (retina for a 1600px display box)

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "public", "banners");
await mkdir(dir, { recursive: true });

let ok = 0, fail = 0;
for (const [slug, { id, fp, ratio }] of Object.entries(banners)) {
  const h = Math.round(W / ratio);
  const ext = id.endsWith(".png") ? "png" : "jpg";
  const url =
    `https://static.wixstatic.com/media/${id}` +
    `/v1/fill/w_${W},h_${h},fp_${fp[0]}_${fp[1]},q_85/banner.${ext}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(path.join(dir, `${slug}.${ext}`), buf);
    ok++;
    console.log(`OK ${slug}.${ext} ${W}x${h} (${(buf.length / 1024).toFixed(0)}kb)`);
  } catch (e) {
    fail++;
    console.error(`FAIL ${slug}: ${e.message}`);
  }
}
console.log(`\n${ok} ok, ${fail} failed`);
