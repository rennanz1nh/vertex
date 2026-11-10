import {
  LayoutDashboard, Car, ClipboardList, CalendarClock, Users, type LucideIcon,
} from "lucide-react";
import type { BrandKey } from "./brand";

export type TabLogo = "googleads" | "searchconsole" | "shopping" | "merchant" | "cloud";
export type SubPage = { title: string; url: string; exact?: boolean; basePath?: string; logo?: TabLogo; pages?: SubPage[]; tab?: string; defaultTab?: boolean; /** Only the owner account (master admin) sees this tab. */ ownerOnly?: boolean };
export type NavItem = {
  title: string;
  url: string;
  /** Path prefix that keeps this item active; defaults to `url`. */
  basePath?: string;
  exact?: boolean;
  icon?: LucideIcon;
  brand?: BrandKey;
  /** Sub-pages shown as tabs at the top of the page (replaces the old sidebar sub-menu). */
  pages?: SubPage[];
  /** Other path prefixes that belong to this item, so it stays active on them. */
  extraPaths?: string[];
  /** Tabs scroll with the page and show no title/logo (channel sections keep a sticky band). */
  staticTabs?: boolean;
};
/** `collapsible` sections get a dropdown header in the sidebar (open/closed is remembered per browser). */
export type NavSection = { title: string; items: NavItem[]; collapsible?: boolean; /** Hidden from non-admin users (e.g. operador). */ adminOnly?: boolean };

// Turo lives as one sidebar item with its tabs shown in the sticky section band at the top of the page.
export const TURO_PAGES: SubPage[] = [
  { title: "Visão Geral", url: "/admin/turo?tab=overview", basePath: "/admin/turo", tab: "overview", defaultTab: true },
  { title: "Reservas", url: "/admin/turo?tab=reservations", basePath: "/admin/turo", tab: "reservations" },
  { title: "Veículos", url: "/admin/turo?tab=vehicles", basePath: "/admin/turo", tab: "vehicles" },
  { title: "Hóspedes", url: "/admin/turo?tab=guests", basePath: "/admin/turo", tab: "guests" },
  { title: "Ganhos", url: "/admin/turo?tab=earnings", basePath: "/admin/turo", tab: "earnings" },
  { title: "Avaliações", url: "/admin/turo?tab=reviews", basePath: "/admin/turo", tab: "reviews" },
  { title: "Métodos", url: "/admin/turo?tab=payout", basePath: "/admin/turo", tab: "payout" },
  { title: "Sincronização", url: "/admin/turo?tab=sync", basePath: "/admin/turo", tab: "sync" },
];

// Sidebar sections mapped from the AppSidebar's existing navigation, now regrouped for V2.
export const SECTIONS: NavSection[] = [
  {
    title: "Menu Principal",
    items: [
      { title: "Dashboard", url: "/admin", exact: true, icon: LayoutDashboard },
      { title: "Carros", url: "/admin/cars", icon: Car },
      { title: "Calendário", url: "/admin/calendar", icon: CalendarClock },
      { title: "Reservas", url: "/admin/bookings", icon: ClipboardList },
      { title: "Clientes", url: "/admin/clients", icon: Users },
      { title: "Turo", url: "/admin/turo", basePath: "/admin/turo", brand: "turo", pages: TURO_PAGES },
    ],
  },
  {
    title: "Automações",
    collapsible: true,
    adminOnly: true,
    items: [
      {
        title: "Google", url: "/admin/automations/search-console/performance", basePath: "/admin/automations/search-console", brand: "google",
        extraPaths: ["/admin/automations/google-shopping", "/admin/automations/google-merchant-center", "/admin/automations/google-cloud"],
        pages: [
          {
            title: "Search Console", url: "/admin/automations/search-console/performance", basePath: "/admin/automations/search-console", logo: "searchconsole",
            pages: [
              { title: "Performance", url: "/admin/automations/search-console/performance" },
              { title: "Indexação", url: "/admin/automations/search-console/indexing" },
            ],
          },
          {
            title: "Google Shopping", url: "/admin/automations/google-shopping/sync", basePath: "/admin/automations/google-shopping", logo: "shopping",
            pages: [
              { title: "Sincronização de Produtos", url: "/admin/automations/google-shopping/sync" },
              { title: "Status", url: "/admin/automations/google-shopping/products" },
              { title: "Performance", url: "/admin/automations/google-shopping/reports/performance" },
            ],
          },
          { title: "Merchant Center", url: "/admin/automations/google-merchant-center", logo: "merchant" },
          {
            title: "Cloud Console", url: "/admin/automations/google-cloud/overview", basePath: "/admin/automations/google-cloud", logo: "cloud",
            pages: [
              { title: "Visão Geral", url: "/admin/automations/google-cloud/overview" },
              { title: "Website Analytics", url: "/admin/automations/google-cloud/traffic" },
              { title: "BigQuery", url: "/admin/automations/google-cloud/bigquery" },
              { title: "Faturamento", url: "/admin/automations/google-cloud/billing" },
              { title: "Acessos (IAM)", url: "/admin/automations/google-cloud/iam" },
              { title: "Logs", url: "/admin/automations/google-cloud/logs" },
            ],
          },
        ],
      },
      { title: "Meta Pixel", url: "/admin/automations/facebook-pixel", brand: "meta" },
      {
        title: "Email Marketing", url: "/admin/email-marketing/overview", basePath: "/admin/email-marketing", brand: "brevo",
        pages: [
          { title: "Visão Geral", url: "/admin/email-marketing/overview", exact: true },
          { title: "Contatos & Listas", url: "/admin/email-marketing/contacts" },
          { title: "Campanhas", url: "/admin/email-marketing/campaigns" },
          { title: "Templates", url: "/admin/email-marketing/templates" },
          { title: "Configurações", url: "/admin/email-marketing/settings" },
        ],
      },
      {
        title: "Stripe", url: "/admin/automations/stripe", basePath: "/admin/automations/stripe", brand: "stripe",
      },
    ],
  },
  {
    title: "Conteúdo",
    collapsible: true,
    adminOnly: true,
    items: [
      { title: "Social Media", url: "/admin/social-media/zernio-hub", basePath: "/admin/social-media", brand: "instagram" },
    ],
  },
];

export const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);

export function itemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.url;
  return pathname.startsWith(item.basePath ?? item.url) || !!item.extraPaths?.some((p) => pathname.startsWith(p));
}

export function pageActive(pathname: string, page: SubPage, params?: URLSearchParams | null) {
  if (page.exact) return pathname === page.url;
  if (!pathname.startsWith(page.basePath ?? page.url)) return false;
  // Query-string-driven tabs (e.g. Turo's ?tab=overview): the first one with `defaultTab`
  // matches when no ?tab= is set, so the band still highlights something on first open.
  if (page.tab) {
    const current = params?.get("tab");
    if (!current) return !!page.defaultTab;
    return current === page.tab;
  }
  return true;
}

/** Pages a non-admin team member (operador) may open: the main menu, chat, and these settings tabs. */
export const OPERADOR_SETTINGS = ["/admin/settings/banners", "/admin/settings/coupons", "/admin/settings/link-bio"];
const OPERADOR_PATHS = ["/admin/cars", "/admin/calendar", "/admin/bookings", "/admin/clients", "/admin/turo", "/admin/chat", ...OPERADOR_SETTINGS];

export function canAccess(pathname: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  if (pathname === "/admin" || pathname === "/admin/") return true;
  return OPERADOR_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
