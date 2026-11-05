import { cn } from "@/lib/utils";

export type BrandKey =
  | "turo" | "stripe" | "google" | "meta" | "brevo" | "instagram";

type Asset = { src: string; dark?: string };
type Spec = { label: string; mark: Asset & { size: number }; word?: Asset & { ratio: number } };

const B = "/images/brand-marks/";

// Marks are sized inside a 28px slot by optical area, and wordmarks are trimmed to their
// real content (no transparent margin) — equal boxes would make some logos look bigger.
// `dark` = negative version for night mode (black parts turned light).
const BRANDS: Record<BrandKey, Spec> = {
  turo: { label: "Turo", mark: { src: "/turo-logo.png", size: 22 }, word: { src: "/turo-logo.png", ratio: 2.701 } },
  stripe: { label: "Stripe", mark: { src: B + "stripe.svg", size: 17 }, word: { src: B + "wm-stripe.svg", ratio: 2.403 } },
  google: { label: "Google", mark: { src: B + "google.svg", size: 19 }, word: { src: B + "wm-google.svg", ratio: 3.043 } },
  meta: { label: "Meta Pixel", mark: { src: B + "meta.svg", size: 21 }, word: { src: B + "wm-meta.svg", dark: B + "wm-meta-dark.svg", ratio: 4.963 } },
  brevo: { label: "Email Marketing", mark: { src: B + "brevo.svg", size: 20 } },
  instagram: { label: "Social Media", mark: { src: B + "instagram.svg", size: 18 } },
};

const WORD_AREA = 1400;
const WORD_MAX_H = 24;
const WORD_MAX_W = 96;

function wordSize(ratio: number) {
  let h = Math.min(Math.sqrt(WORD_AREA / ratio), WORD_MAX_H);
  let w = h * ratio;
  if (w > WORD_MAX_W) {
    w = WORD_MAX_W;
    h = w / ratio;
  }
  return { width: Math.round(w * 10) / 10, height: Math.round(h * 10) / 10 };
}

/** Light/dark pair: the CSS on <html data-admin-v2> shows the one that matches the theme. */
function Themed({ asset, alt, style }: { asset: Asset; alt: string; style: React.CSSProperties }) {
  /* eslint-disable @next/next/no-img-element */
  if (!asset.dark) return <img src={asset.src} alt={alt} style={style} />;
  return (
    <>
      <img src={asset.src} alt={alt} style={style} className="v2-light-only" />
      <img src={asset.dark} alt={alt} style={style} className="v2-dark-only" />
    </>
  );
  /* eslint-enable @next/next/no-img-element */
}

/** Square official mark on a transparent background, centered in a `slot`px box. */
export function BrandMark({ brand, slot = 28, className }: { brand: BrandKey; slot?: number; className?: string }) {
  const m = BRANDS[brand].mark;
  const px = (m.size * slot) / 28;
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", className)} style={{ width: slot, height: slot }}>
      <Themed asset={m} alt={BRANDS[brand].label} style={{ width: px, height: px, objectFit: "contain" }} />
    </span>
  );
}

/** Full wordmark at optical size; brands without one fall back to mark + name. */
export function BrandWord({ brand }: { brand: BrandKey }) {
  const spec = BRANDS[brand];
  if (!spec.word) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <BrandMark brand={brand} slot={24} />
        <span className="truncate">{spec.label}</span>
      </span>
    );
  }
  return <Themed asset={spec.word} alt={spec.label} style={wordSize(spec.word.ratio)} />;
}

export function brandLabel(brand: BrandKey) {
  return BRANDS[brand].label;
}
