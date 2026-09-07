// Shared types + constants for the admin-managed site banners (Settings >
// Banners): hero banners on the home/category pages, and popups, each
// optionally with a link, overlay text, and a corner ribbon ("fita").

export type BannerPlacement = "hero" | "popup";
export type BannerMediaType = "image" | "video";
export type RibbonPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type Banner = {
  id: string;
  title: string;
  page: string;
  placement: BannerPlacement;
  media_type: BannerMediaType;
  media_url: string;
  link_url: string | null;
  overlay_text: string | null;
  subtitle_text: string | null;
  button_text: string | null;
  duration_seconds: number;
  ribbon_text: string | null;
  ribbon_color: string | null;
  ribbon_position: RibbonPosition;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Pages a banner can target. "*" only makes sense for popups (shows on every page). */
export const BANNER_PAGE_OPTIONS = [
  { value: "*", label: "Todas as páginas" },
  { value: "home", label: "Home" },
  { value: "women", label: "Women (All Products)" },
  { value: "women-skin", label: "Women's Skin" },
  { value: "women-body", label: "Women's Body" },
  { value: "women-hair", label: "Women's Hair" },
  { value: "professional", label: "Professional" },
  { value: "men", label: "Men" },
  { value: "clearance", label: "Sale | Clearance" },
  { value: "contact-us", label: "Contact Us" },
  { value: "sell-with-us", label: "Sell With Us" },
] as const;

export const RIBBON_POSITION_OPTIONS: { value: RibbonPosition; label: string }[] = [
  { value: "top-left", label: "Canto superior esquerdo" },
  { value: "top-right", label: "Canto superior direito" },
  { value: "bottom-left", label: "Canto inferior esquerdo" },
  { value: "bottom-right", label: "Canto inferior direito" },
];

/** Maps a store pathname (from usePathname()) to the "page" key used by banners. */
export function pathnameToPageKey(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment || "home";
}
