// Parses a pasted product text block (Description / Benefits / Active Ingredients /
// Recommended For / How to Use / Ingredients / Weight & Dimensions, in any order) into
// structured sections, then renders a marketplace-style HTML description from them —
// same shape as the reference eBay description generator this was ported from.

export type IntroSection = { key: string; type: "intro"; title: null; data: string[] };
export type BenefitsSection = { key: string; type: "benefits"; title: string; data: string[] };
export type IngredientEntry = { name: string; desc: string };
export type IngredientsSection = { key: string; type: "ingredients"; title: string; data: IngredientEntry[] };
export type RecommendedSection = { key: string; type: "recommended"; title: string; data: string[] };
export type StepsSection = { key: string; type: "steps"; title: string; data: string[] };
export type InciSection = { key: string; type: "inci"; title: string; data: string };
export type DimsEntry = { label: string; size: string; weight: string; h: string; w: string; l: string };
export type DimsSection = { key: string; type: "dims"; title: string; data: DimsEntry[] };

export type ParsedSection =
  | IntroSection | BenefitsSection | IngredientsSection | RecommendedSection
  | StepsSection | InciSection | DimsSection;

export type ParsedProduct = {
  productName: string;
  brand: string;
  subtitle: string;
  sections: ParsedSection[];
  footerNote: string;
};

const KNOWN_BRANDS = ["Prophecy", "HannaLee", "Hanna Lee", "Sorali", "Velora"];

const SECTION_TITLES: Record<string, string | null> = {
  intro: null,
  benefits: "Benefits",
  ingredients: "Active Ingredients",
  recommended: "Recommended For",
  steps: "How to Use",
  inci: "Full Ingredient List",
  dims: "Weight & Dimensions",
};

function stripBullet(line: string): string {
  return line.replace(/^[\s]*[·•\-*]+[\s]*/, "").replace(/^\d+\.\s*/, "").trim();
}

function normHeader(line: string): string {
  return line.trim().replace(/:\s*$/, "").toLowerCase();
}

type Buckets = {
  intro: string[];
  benefits: string[];
  ingredients: string[];
  recommended: string[];
  steps: string[];
  inci: string[];
  dims: string[];
};

export function parseProductText(raw: string): ParsedProduct {
  const lines = raw.split(/\r?\n/);

  // Pre-extract trailing signature lines (e.g. "BRAND - PRODUCT") that sit after all
  // real content, so they don't get swallowed into the last section.
  const sigLines: string[] = [];
  let trimEnd = lines.length;
  for (let k = lines.length - 1; k >= 0; k--) {
    const t = lines[k].trim();
    if (t === "") { trimEnd = k; continue; }
    if (t.length <= 50 && !/[.!?]$/.test(t) && !/^\d+\./.test(t)) {
      sigLines.unshift(t);
      trimEnd = k;
    } else break;
  }
  const bodyLines = sigLines.length ? lines.slice(0, trimEnd) : lines;

  let current = "intro";
  const buckets: Buckets = { intro: [], benefits: [], ingredients: [], recommended: [], steps: [], inci: [], dims: [] };
  const dimsGroups: DimsEntry[] = [];
  let currentDimsGroup: DimsEntry | null = null;
  let ebayName = "";
  const disclaimerLines: string[] = [];
  const capsCandidates: { line: string; index: number }[] = [];

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (current === "intro") buckets.intro.push("");
      continue;
    }

    const norm = normHeader(trimmed);

    if (/^\*/.test(trimmed)) {
      disclaimerLines.push(trimmed.replace(/^\*+\s*/, "*"));
      continue;
    }

    if (norm === "description") { current = "intro"; continue; }
    if (norm === "benefits") { current = "benefits"; continue; }
    if (norm === "active ingredients") { current = "ingredients"; continue; }
    if (norm === "ingredients") { current = "inci"; continue; }
    if (norm === "recommended for") { current = "recommended"; continue; }
    if (norm === "directions for use" || norm === "how to use" || norm === "instructions" || norm === "directions") { current = "steps"; continue; }
    if (norm.startsWith("weight & dimensions") || norm.startsWith("weight and dimensions") || norm.startsWith("weight &amp; dimensions")) {
      const m = trimmed.match(/[–-]\s*([A-Za-z0-9.]+)\s*$/);
      currentDimsGroup = { label: m ? m[1] : "", size: m ? m[1] : "", weight: "", h: "", w: "", l: "" };
      dimsGroups.push(currentDimsGroup);
      current = "dims";
      continue;
    }
    if (norm === "seo") { current = "skip"; continue; }
    if (norm.startsWith("meta title") || norm.startsWith("meta description") || norm.startsWith("meta keywords")) { current = "skip"; continue; }
    if (norm.startsWith("ebay name")) {
      const parts = trimmed.split(":");
      if (parts.length > 1) ebayName = parts.slice(1).join(":").trim();
      else current = "ebayname";
      continue;
    }
    if (current === "ebayname") { ebayName = trimmed; current = "skip"; continue; }

    if (/^[A-Z0-9][A-Z0-9 ,+&'-]{3,59}$/.test(trimmed) && !/^\d+\.\s/.test(trimmed)) {
      capsCandidates.push({ line: trimmed, index: i });
    }

    if (current === "dims" && currentDimsGroup) {
      const dm = trimmed.match(/^(Weight|Height|Width|Length)\s*:\s*(.+)$/i);
      if (dm) {
        const key = dm[1].toLowerCase();
        if (key === "weight") currentDimsGroup.weight = dm[2].trim();
        else if (key === "height") currentDimsGroup.h = dm[2].trim();
        else if (key === "width") currentDimsGroup.w = dm[2].trim();
        else if (key === "length") currentDimsGroup.l = dm[2].trim();
      }
      continue;
    }
    if (current === "skip") continue;
    if (current in buckets) (buckets as Record<string, string[]>)[current].push(trimmed);
  }

  // ---- intro paragraphs ----
  const introRaw = buckets.intro.join("\n");
  const introParas = introRaw.split(/\n\s*\n/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);

  // ---- product name / brand guesses ----
  let productName = "";
  let brand = "";
  KNOWN_BRANDS.forEach((b) => {
    if (new RegExp(b, "i").test(raw)) { if (!brand) brand = b; }
  });
  if (capsCandidates.length) {
    productName = capsCandidates[0].line;
    if (introParas.length && introParas[0].trim().toLowerCase() === productName.trim().toLowerCase()) {
      introParas.shift();
    }
  } else if (sigLines.length) {
    if (/ - /.test(sigLines[0])) {
      const parts = sigLines[0].split(" - ");
      if (!brand) brand = parts[0].trim();
      productName = parts.slice(1).join(" - ").trim();
    } else {
      productName = sigLines[0];
    }
  }
  if (!productName && ebayName) productName = ebayName;
  if (brand && productName) {
    const escBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("^" + escBrand + "\\s*[-–]\\s*", "i");
    if (re.test(productName)) productName = productName.replace(re, "").trim();
  }

  // ---- benefits ----
  const benefits = buckets.benefits.map(stripBullet).filter(Boolean);

  // ---- active ingredients (name/desc pairing) ----
  const ingLines = buckets.ingredients.map(stripBullet).filter(Boolean);
  const ingredients: IngredientEntry[] = [];
  for (let i = 0; i < ingLines.length; i++) {
    const line = ingLines[i];
    const colonMatch = line.match(/^([A-Za-z0-9 \-/]{2,45}):\s*(.+)$/);
    if (colonMatch) {
      ingredients.push({ name: colonMatch[1].trim(), desc: colonMatch[2].trim() });
      continue;
    }
    const looksLikeName = line.length <= 45 && !/[.!]$/.test(line) && line.split(" ").length <= 6;
    if (looksLikeName && ingLines[i + 1]) {
      ingredients.push({ name: line, desc: ingLines[i + 1].trim() });
      i++;
    } else {
      ingredients.push({ name: "", desc: line });
    }
  }

  // ---- recommended for ----
  const recommended = buckets.recommended.map(stripBullet).filter(Boolean);

  // ---- steps ----
  const stepsJoined = buckets.steps.join(" ").replace(/\s+/g, " ").trim();
  let steps = stepsJoined.split(/(?:^|\s)\d+\.\s+/).map((s) => s.trim()).filter(Boolean);
  if (steps.length === 0) steps = buckets.steps.map(stripBullet).filter(Boolean);

  // ---- inci full list ----
  const inci = buckets.inci.join(" ").replace(/\s+/g, " ").trim();

  // ---- dims ----
  const dims = dimsGroups.filter((g) => g.weight || g.h || g.w || g.l);

  // ---- assemble ordered sections (based on first-seen order) ----
  const order: ParsedSection[] = [];
  if (introParas.length) order.push({ key: "intro", type: "intro", title: null, data: introParas });
  if (benefits.length) order.push({ key: "benefits", type: "benefits", title: SECTION_TITLES.benefits!, data: benefits });
  if (ingredients.length) order.push({ key: "ingredients", type: "ingredients", title: SECTION_TITLES.ingredients!, data: ingredients });
  if (recommended.length) order.push({ key: "recommended", type: "recommended", title: SECTION_TITLES.recommended!, data: recommended });
  if (steps.length) order.push({ key: "steps", type: "steps", title: SECTION_TITLES.steps!, data: steps });
  if (inci.length) order.push({ key: "inci", type: "inci", title: SECTION_TITLES.inci!, data: inci });
  if (dims.length) order.push({ key: "dims", type: "dims", title: SECTION_TITLES.dims!, data: dims });

  return {
    productName,
    brand,
    subtitle: ebayName,
    sections: order,
    footerNote: disclaimerLines.join(" "),
  };
}

// ---------- HTML rendering ----------

const DARK = "#2d4a35";
const MID = "#4a7c59";
const BG = "#fffaf3";

function escapeHTML(s: string | null | undefined): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string | null | undefined): string {
  return (s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export type SectionImageState = { imgOn: boolean; imgUrl: string };

function renderSection(sec: ParsedSection, img: SectionImageState, productName: string): string {
  let html = "";
  if (img.imgOn && img.imgUrl) {
    html += `  <img src="${img.imgUrl}" alt="${escapeAttr(sec.title || "Product")}" style="width:100%;display:block;">\n\n`;
  }

  if (sec.type === "intro") {
    html += `  <div style="padding:24px 20px;background:${BG};">\n`;
    html += `    <h2 style="color:${DARK};font-size:22px;margin-top:0;">${escapeHTML(productName || "Overview")}</h2>\n`;
    sec.data.forEach((p) => { html += `    <p style="font-size:15px;">${escapeHTML(p)}</p>\n`; });
    html += `  </div>\n\n`;
  } else if (sec.type === "benefits") {
    html += `  <div style="padding:24px 20px;background:#ffffff;">\n`;
    html += `    <h2 style="color:${DARK};font-size:22px;margin-top:0;">Benefits</h2>\n`;
    html += `    <table style="width:100%;border-collapse:collapse;font-size:15px;">\n`;
    sec.data.forEach((b, i) => {
      const bd = i === sec.data.length - 1 ? "" : "border-bottom:1px solid #eee;";
      html += `      <tr><td style="padding:8px 0;width:26px;${bd}">✔️</td><td style="padding:8px 0;${bd}">${escapeHTML(b)}</td></tr>\n`;
    });
    html += `    </table>\n  </div>\n\n`;
  } else if (sec.type === "ingredients") {
    html += `  <div style="padding:24px 20px;background:${BG};">\n`;
    html += `    <h2 style="color:${DARK};font-size:22px;margin-top:0;">Active Ingredients</h2>\n`;
    html += `    <table style="width:100%;border-collapse:separate;border-spacing:7px;">\n`;
    for (let i = 0; i < sec.data.length; i += 3) {
      html += `      <tr>\n`;
      for (let j = i; j < i + 3; j++) {
        const entry = sec.data[j];
        if (entry) {
          html += `        <td style="width:33%;background:#ffffff;border:1px solid #eee;border-radius:8px;padding:14px;vertical-align:top;">\n`;
          if (entry.name) html += `          <div style="font-weight:bold;color:${DARK};font-size:15px;margin-bottom:4px;">${escapeHTML(entry.name)}</div>\n`;
          html += `          <div style="font-size:13px;">${escapeHTML(entry.desc)}</div>\n`;
          html += `        </td>\n`;
        } else {
          html += `        <td style="width:33%;"></td>\n`;
        }
      }
      html += `      </tr>\n`;
    }
    html += `    </table>\n  </div>\n\n`;
  } else if (sec.type === "recommended") {
    html += `  <div style="padding:24px 20px;background:#ffffff;">\n`;
    html += `    <h2 style="color:${DARK};font-size:22px;margin-top:0;">Recommended For</h2>\n`;
    html += `    <ul style="font-size:15px;padding-left:20px;">\n`;
    sec.data.forEach((r, i) => {
      const mb = i === sec.data.length - 1 ? "" : "margin-bottom:8px;";
      html += `      <li style="${mb}">${escapeHTML(r)}</li>\n`;
    });
    html += `    </ul>\n  </div>\n\n`;
  } else if (sec.type === "steps") {
    html += `  <div style="padding:24px 20px;background:${BG};">\n`;
    html += `    <h2 style="color:${DARK};font-size:22px;margin-top:0;">How to Use</h2>\n`;
    html += `    <ol style="font-size:15px;padding-left:20px;">\n`;
    sec.data.forEach((s, i) => {
      const mb = i === sec.data.length - 1 ? "" : "margin-bottom:10px;";
      html += `      <li style="${mb}">${escapeHTML(s)}</li>\n`;
    });
    html += `    </ol>\n  </div>\n\n`;
  } else if (sec.type === "inci") {
    html += `  <div style="padding:24px 20px;background:#ffffff;">\n`;
    html += `    <h2 style="color:${DARK};font-size:22px;margin-top:0;">Full Ingredient List</h2>\n`;
    html += `    <p style="font-size:12.5px;color:#555;">${escapeHTML(sec.data)}</p>\n`;
    html += `  </div>\n\n`;
  } else if (sec.type === "dims") {
    html += `  <div style="padding:24px 20px;background:${BG};">\n`;
    html += `    <h2 style="color:${DARK};font-size:22px;margin-top:0;">Weight &amp; Dimensions</h2>\n`;
    html += `    <table style="width:100%;border-collapse:collapse;font-size:14px;">\n`;
    html += `      <tr style="background:#f4f7f4;">\n        <td style="padding:8px 10px;font-weight:bold;border-bottom:1px solid #e2e2e2;">Size</td>\n        <td style="padding:8px 10px;font-weight:bold;border-bottom:1px solid #e2e2e2;">Weight</td>\n        <td style="padding:8px 10px;font-weight:bold;border-bottom:1px solid #e2e2e2;">Height</td>\n        <td style="padding:8px 10px;font-weight:bold;border-bottom:1px solid #e2e2e2;">Width</td>\n        <td style="padding:8px 10px;font-weight:bold;border-bottom:1px solid #e2e2e2;">Length</td>\n      </tr>\n`;
    sec.data.forEach((d, i) => {
      const bd = i === sec.data.length - 1 ? "" : "border-bottom:1px solid #eee;";
      html += `      <tr><td style="padding:8px 10px;${bd}">${escapeHTML(d.size || d.label || "")}</td><td style="padding:8px 10px;${bd}">${escapeHTML(d.weight)}</td><td style="padding:8px 10px;${bd}">${escapeHTML(d.h)}</td><td style="padding:8px 10px;${bd}">${escapeHTML(d.w)}</td><td style="padding:8px 10px;${bd}">${escapeHTML(d.l)}</td></tr>\n`;
    });
    html += `    </table>\n  </div>\n\n`;
  }
  return html;
}

export function buildHTML(params: {
  brand: string;
  productName: string;
  subtitle: string;
  sections: ParsedSection[];
  sectionImages: Record<string, SectionImageState>;
  heroImage: SectionImageState;
  footerL1: string;
  footerNote: string;
}): string {
  const { brand, productName, subtitle, sections, sectionImages, heroImage, footerL1, footerNote } = params;

  let html = "";
  html += `<div style="max-width:800px;margin:0 auto;font-family:Arial, Helvetica, sans-serif;color:#2b2b2b;line-height:1.5;">\n\n`;

  if (heroImage.imgOn && heroImage.imgUrl) {
    html += `  <img src="${heroImage.imgUrl}" alt="${escapeAttr(productName)}" style="width:100%;display:block;">\n\n`;
  }

  html += `  <div style="background:linear-gradient(135deg,${MID},${DARK});padding:28px 20px;text-align:center;border-radius:8px 8px 0 0;">\n`;
  if (brand) html += `    <div style="font-size:13px;letter-spacing:2px;color:#dff0e3;text-transform:uppercase;">${escapeHTML(brand)}</div>\n`;
  html += `    <h1 style="margin:6px 0 4px;color:#ffffff;font-size:30px;letter-spacing:1px;">${escapeHTML(productName)}</h1>\n`;
  if (subtitle) html += `    <div style="color:#f5e9d3;font-size:15px;font-weight:bold;">${escapeHTML(subtitle)}</div>\n`;
  html += `  </div>\n\n`;

  sections.forEach((sec) => {
    html += renderSection(sec, sectionImages[sec.key] ?? { imgOn: false, imgUrl: "" }, productName);
  });

  html += `  <div style="background:#2b2b2b;padding:20px;text-align:center;border-radius:0 0 8px 8px;">\n`;
  if (footerL1) html += `    <div style="color:#dff0e3;font-size:14px;letter-spacing:1px;">${escapeHTML(footerL1)}</div>\n`;
  if (footerNote) html += `    <div style="color:#999;font-size:11px;margin-top:8px;max-width:600px;margin-left:auto;margin-right:auto;">${escapeHTML(footerNote)}</div>\n`;
  html += `  </div>\n\n</div>`;

  return html;
}

export function sectionLabel(sec: ParsedSection): string {
  return sec.type === "intro" ? "Introdução / Descrição" : sec.title;
}
