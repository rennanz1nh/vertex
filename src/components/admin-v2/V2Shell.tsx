"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown, PanelLeft, MessageCircle, Moon, Sun, Store, LogOut, ChevronRight, Settings, Home, Car, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { authedFetch } from "@/lib/admin-fetch";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";
import { TuroSyncStaleBanner } from "@/components/admin/TuroSyncStaleBanner";
import { CURRENT_VERSION } from "@/data/updates";
import { GoogleAdsLogo, GoogleCloudLogo, GoogleMerchantCenterLogo, GoogleSearchConsoleLogo } from "@/components/brand-logos";
import { BrandMark, BrandWord } from "./brand";
import { usePref, writePref, RAIL_KEY, THEME_KEY } from "./prefs";
import { SECTIONS, ALL_ITEMS, itemActive, pageActive, type NavItem, type NavSection, type TabLogo } from "./nav";

const TABS = [
  { title: "Dashboard", url: "/admin", exact: true, icon: Home },
  { title: "Carros", url: "/admin/cars", icon: Car },
  { title: "Reservas", url: "/admin/bookings", icon: ClipboardList },
];

function ItemGlyph({ item, slot = 28 }: { item: NavItem; slot?: number }) {
  if (item.brand) return <BrandMark brand={item.brand} slot={slot} />;
  const Icon = item.icon ?? ChevronRight;
  return (
    <span className="inline-flex shrink-0 items-center justify-center" style={{ width: slot, height: slot }}>
      <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
    </span>
  );
}

function useUnreadChats() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const fetchUnread = async () => {
      const res = await authedFetch("/api/admin/chat/conversations");
      if (!res.ok) return;
      const data = await res.json();
      setUnread((data.conversations ?? []).reduce((sum: number, c: { unread_count: number }) => sum + c.unread_count, 0));
    };
    fetchUnread();
    const channel = supabase
      .channel("admin-v2-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => fetchUnread())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => fetchUnread())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  return unread;
}

type Tab = { title: string; href: string; active: boolean; logo?: TabLogo };

/** Tab rows for the active section: its sub-pages (plus a second row when the active sub-page has its own). */
function useSectionTabs(pathname: string, item: NavItem | undefined): Tab[][] {
  const params = useSearchParams();
  if (!item) return [];
  if (!item.pages) return [];
  const rows: Tab[][] = [item.pages.map((p) => ({ title: p.title, href: p.url, active: pageActive(pathname, p, params), logo: p.logo }))];
  const sub = item.pages.find((p) => p.pages && pageActive(pathname, p, params));
  if (sub?.pages) rows.push(sub.pages.map((p) => ({ title: p.title, href: p.url, active: pageActive(pathname, p, params) })));
  return rows;
}

/** Product logo shown in Google's tabs (desktop only); gets a white chip when the tab is active so it stays legible. */
function TabLogoMark({ name, active }: { name: TabLogo; active: boolean }) {
  const cls = "h-4 w-4 shrink-0";
  return (
    <span className={cn("mr-1.5 hidden h-5 w-5 shrink-0 items-center justify-center rounded md:inline-flex", active && "bg-white")}>
      {name === "googleads" ? <GoogleAdsLogo className={cls} /> : name === "searchconsole" ? <GoogleSearchConsoleLogo className={cls} /> : name === "merchant" ? <GoogleMerchantCenterLogo className={cls} /> : name === "cloud" ? <GoogleCloudLogo className={cls} /> : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/images/sales-channels/GoogleShopping.svg" alt="" className={cls} />
      )}
    </span>
  );
}

function Pill({ tab, small }: { tab: Tab; small?: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={tab.active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-md transition-colors",
        small ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
        tab.active
          ? "bg-[var(--v2-primary)] font-semibold text-[var(--v2-primary-fg)]"
          : "font-medium text-[var(--v2-muted)] hover:bg-[var(--v2-surface-2)] hover:text-[var(--v2-text)]"
      )}
    >
      {tab.logo && <TabLogoMark name={tab.logo} active={tab.active} />}
      {tab.title}
    </Link>
  );
}

/** Sticky header for channel sections: brand logo + compact tabs, the same on every sub-page. */
function SectionBand({ item, rows }: { item: NavItem; rows: Tab[][] }) {
  const ref = useRef<HTMLDivElement>(null);
  const activeKey = rows.map((r) => r.find((tab) => tab.active)?.href ?? "").join("|");
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>('[aria-current="page"]').forEach((el) => el.scrollIntoView({ block: "nearest", inline: "center" }));
  }, [activeKey]);
  return (
    <div ref={ref} className={cn("-mx-4 -mt-4 border-b border-[var(--v2-border)] bg-[var(--v2-bg)] px-4 py-2.5 md:-mx-7 md:-mt-5 md:px-7", !item.staticTabs && "sticky top-14 z-10")}>
      <div className="flex items-center gap-3">
        {!item.staticTabs && (
          <span className="flex h-8 shrink-0 items-center gap-2 text-[15px] font-bold">
            {item.brand ? (
              <BrandWord brand={item.brand} />
            ) : (
              <>
                <ItemGlyph item={item} slot={24} />
                {item.title}
              </>
            )}
          </span>
        )}
        {rows[0] && (
          <>
            {!item.staticTabs && <span className="h-5 w-px shrink-0 bg-[var(--v2-border)]" />}
            <div className="v2-noscrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {rows[0].map((tab) => (
                <Pill key={tab.href} tab={tab} />
              ))}
            </div>
          </>
        )}
      </div>
      {rows[1] && (
        <div className="v2-noscrollbar mt-2 flex gap-1 overflow-x-auto border-t border-[var(--v2-border)] pt-2">
          {rows[1].map((tab) => (
            <Pill key={tab.href} tab={tab} small />
          ))}
        </div>
      )}
    </div>
  );
}

/** One sidebar group. Collapsible groups get a dropdown header; while collapsed, the page you are on stays visible.
 *  In the icon rail there are no headers, so every item shows. */
function SidebarSection({ section, rail, pathname }: { section: NavSection; rail: boolean; pathname: string }) {
  const prefKey = `admin-v2-sec-${section.title}`;
  const pref = usePref(prefKey);
  const closed = !!section.collapsible && pref === "0";
  const items = rail || !closed ? section.items : section.items.filter((i) => itemActive(pathname, i));
  return (
    <div className="flex flex-col gap-0.5">
      {rail ? (
        <div className="mx-2 mb-2 h-px bg-[var(--v2-border)]" />
      ) : section.collapsible ? (
        <button
          type="button"
          onClick={() => writePref(prefKey, closed ? "1" : "0")}
          aria-expanded={!closed}
          className="v2-mono mb-1 flex h-7 items-center justify-between rounded-md px-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--v2-muted)] hover:bg-[var(--v2-surface-2)] hover:text-[var(--v2-text)]"
        >
          {section.title}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", closed && "-rotate-90")} />
        </button>
      ) : (
        <p className="v2-mono mb-1.5 px-2.5 text-[10px] uppercase tracking-[0.18em] text-[var(--v2-muted)]">{section.title}</p>
      )}
      {items.map((item) => {
        const on = itemActive(pathname, item);
        return (
          <Link
            key={item.url}
            href={item.url}
            title={item.title}
            aria-label={item.title}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex h-10 items-center gap-[11px] rounded-[10px] text-[13.5px] transition-colors",
              rail ? "justify-center" : "pl-3 pr-2.5",
              on ? "bg-[var(--v2-active)] font-bold text-[var(--v2-text)] shadow-[0_0_0_1px_var(--v2-border)]" : "font-medium text-[var(--v2-muted)] hover:bg-[var(--v2-surface-2)] hover:text-[var(--v2-text)]"
            )}
          >
            <span className={cn("absolute bottom-[9px] left-0 top-[9px] w-[3px] rounded-r", on ? "bg-[var(--v2-flag)]" : "bg-transparent")} />
            {rail ? (
              <ItemGlyph item={item} />
            ) : item.brand ? (
              <span className="flex h-7 min-w-0 flex-1 items-center pl-0.5">
                <BrandWord brand={item.brand} />
              </span>
            ) : (
              <>
                <ItemGlyph item={item} />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function V2Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut, profile, user } = useAuth();
  const unread = useUnreadChats();
  const dark = usePref(THEME_KEY) === "dark";
  const rail = usePref(RAIL_KEY) === "1";
  // The mobile menu belongs to the page it was opened on, so navigating closes it.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;

  // The theme lives on <html> so dialogs/popovers portaled to <body> follow it too.
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.adminV2 = dark ? "dark" : "light";
    return () => {
      delete html.dataset.adminV2;
    };
  }, [dark]);

  const toggleDark = () => writePref(THEME_KEY, dark ? "light" : "dark");
  const toggleRail = () => writePref(RAIL_KEY, rail ? "0" : "1");

  const activeItem = ALL_ITEMS.find((i) => itemActive(pathname, i));
  const sectionRows = useSectionTabs(pathname, activeItem);
  const showBand = !!activeItem && (!!activeItem.brand || !!activeItem.pages);
  const name: string = profile?.full_name || profile?.name || user?.email?.split("@")[0] || "Admin";
  const role: string = profile?.role ?? "admin";
  const initial = name.charAt(0).toUpperCase();
  const iconBtn = "flex h-11 w-11 items-center justify-center rounded-[10px] text-[var(--v2-muted)] hover:bg-[var(--v2-surface-2)] hover:text-[var(--v2-text)] md:h-[38px] md:w-[38px]";

  return (
    <div data-menu-open={menuOpen} className="admin-v2 flex min-h-screen w-full bg-[var(--v2-bg)] text-[var(--v2-text)]">
      <aside
        aria-label="Menu principal"
        className="sticky top-0 hidden h-screen shrink-0 flex-col border-r border-[var(--v2-border)] bg-[var(--v2-side)] transition-[width] duration-200 md:flex"
        style={{ width: rail ? 72 : 248 }}
      >
        <div className={cn("flex h-16 shrink-0 items-center border-b border-[var(--v2-border)]", rail ? "justify-center" : "px-4")}>
          {/* eslint-disable @next/next/no-img-element */}
          {rail ? (
            <img src="/icons/Small.png" alt="Vertex Rental Cars" className="h-8 w-8 object-contain" />
          ) : (
            <>
              <img src="/images/store-logo-sidebar.png" alt="Vertex Rental Cars" className="v2-light-only mx-auto max-h-11 w-auto object-contain" />
              <img src="/images/store-logo-sidebar.png" alt="Vertex Rental Cars" className="v2-dark-only mx-auto max-h-11 w-auto object-contain [filter:invert(1)_hue-rotate(180deg)_brightness(1.15)]" />
            </>
          )}
          {/* eslint-enable @next/next/no-img-element */}
        </div>

        <nav className="v2-noscrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3.5">
          {SECTIONS.map((section) => (
            <SidebarSection key={section.title} section={section} rail={rail} pathname={pathname} />
          ))}
        </nav>

        <div className={cn("flex shrink-0 items-center gap-2.5 border-t border-[var(--v2-border)] p-3", rail && "flex-col")}>
          <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--v2-flag)] text-sm font-extrabold text-[#141414]">{initial}</span>
          {!rail && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">{name}</span>
              <Link href="/admin/settings/updates" className="v2-mono block truncate text-[10.5px] text-[var(--v2-muted)] hover:underline">
                {role} · v{CURRENT_VERSION}
              </Link>
            </span>
          )}
          <button
            type="button"
            onClick={signOut}
            title="Sair"
            aria-label="Sair"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--v2-bad-bg)] text-[var(--v2-bad)]"
          >
            <LogOut className="h-[17px] w-[17px]" />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-1 border-b border-[var(--v2-border)] bg-[var(--v2-bar)] pl-3 pr-1.5 md:gap-1.5 md:px-4">
          <button type="button" onClick={toggleRail} aria-label="Recolher ou expandir menu" title="Recolher / expandir menu" className={cn(iconBtn, "hidden md:flex")}>
            <PanelLeft className="h-[19px] w-[19px]" strokeWidth={1.8} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/Small.png" alt="" className="h-7 w-7 object-contain md:hidden" />
          <div className="flex-1" />
          <Link href="/admin/chat" aria-label={`Mensagens${unread ? ` (${unread} não lidas)` : ""}`} title="Mensagens" className={cn(iconBtn, "relative", pathname.startsWith("/admin/chat") && "bg-[var(--v2-surface-2)] text-[var(--v2-text)]")}>
            <MessageCircle className="h-[19px] w-[19px]" strokeWidth={1.8} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9.5px] font-extrabold text-white">{unread}</span>
            )}
          </Link>
          <NotificationBell />
          <Link href="/admin/settings" aria-label="Configurações" title="Configurações" className={cn(iconBtn, "hidden md:flex", pathname.startsWith("/admin/settings") && "bg-[var(--v2-surface-2)] text-[var(--v2-text)]")}>
            <Settings className="h-[19px] w-[19px]" strokeWidth={1.8} />
          </Link>
          <button type="button" onClick={toggleDark} aria-label={dark ? "Mudar para modo claro" : "Mudar para modo noturno"} title={dark ? "Modo claro" : "Modo noturno"} className={cn(iconBtn, "text-[var(--v2-accent)]")}>
            {dark ? <Sun className="h-[19px] w-[19px]" strokeWidth={1.8} /> : <Moon className="h-[19px] w-[19px]" strokeWidth={1.8} />}
          </button>
          <Link href="/" aria-label="Loja" title="Loja" className={cn(iconBtn, "hidden md:flex")}>
            <Store className="h-[19px] w-[19px]" strokeWidth={1.8} />
          </Link>
        </header>

        <main className={cn("flex flex-1 flex-col gap-5 px-4 pb-28 pt-4 md:px-7 md:pb-8 md:pt-5", showBand && "v2-section")}>
          {showBand && activeItem && <SectionBand item={activeItem} rows={sectionRows} />}
          <TuroSyncStaleBanner />
          <div className="min-w-0 flex-1">{children}</div>
        </main>
      </div>

      {menuOpen && (
        <div className="fixed inset-x-0 bottom-[68px] top-14 z-30 overflow-y-auto bg-[var(--v2-bg)] p-4 md:hidden">
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--v2-flag)] text-[17px] font-extrabold text-[#141414]">{initial}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{name}</span>
                <span className="v2-mono block text-[11px] text-[var(--v2-muted)]">{role} · v{CURRENT_VERSION}</span>
              </span>
            </div>
            {SECTIONS.map((section) => {
              const branded = section.items.every((i) => i.brand);
              return (
                <div key={section.title} className="flex flex-col gap-2.5">
                  <p className="v2-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--v2-muted)]">{section.title}</p>
                  {branded ? (
                    <div className="grid grid-cols-3 gap-2.5">
                      {section.items.map((item) => (
                        <Link
                          key={item.url}
                          href={item.url}
                          aria-current={itemActive(pathname, item) ? "page" : undefined}
                          className={cn(
                            "flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[14px] border bg-[var(--v2-surface)] px-1 text-center text-[11.5px] font-semibold leading-tight",
                            itemActive(pathname, item) ? "border-[var(--v2-flag)]" : "border-[var(--v2-border)]"
                          )}
                        >
                          <ItemGlyph item={item} slot={30} />
                          {item.title}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-[14px] border border-[var(--v2-border)] bg-[var(--v2-surface)]">
                      {section.items.map((item, i) => (
                        <Link key={item.url} href={item.url} className={cn("flex h-[50px] items-center gap-3 px-3.5 text-sm font-semibold", i > 0 && "border-t border-[var(--v2-border)]")}>
                          <ItemGlyph item={item} slot={26} />
                          <span className="flex-1">{item.title}</span>
                          <ChevronRight className="h-4 w-4 text-[var(--v2-muted)]" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="overflow-hidden rounded-[14px] border border-[var(--v2-border)] bg-[var(--v2-surface)]">
              <Link href="/admin/settings" className="flex h-[50px] items-center gap-3 px-3.5 text-sm font-semibold">
                <Settings className="h-[19px] w-[19px] text-[var(--v2-muted)]" />
                <span className="flex-1">Configurações</span>
                <ChevronRight className="h-4 w-4 text-[var(--v2-muted)]" />
              </Link>
              <Link href="/" className="flex h-[50px] items-center gap-3 border-t border-[var(--v2-border)] px-3.5 text-sm font-semibold">
                <Store className="h-[19px] w-[19px] text-[var(--v2-muted)]" />
                <span className="flex-1">Loja</span>
                <ChevronRight className="h-4 w-4 text-[var(--v2-muted)]" />
              </Link>
            </div>
            <button type="button" onClick={toggleDark} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--v2-border)] bg-[var(--v2-surface)] text-[13px] font-bold">
              {dark ? <Sun className="h-[17px] w-[17px] text-[var(--v2-accent)]" /> : <Moon className="h-[17px] w-[17px] text-[var(--v2-accent)]" />}
              {dark ? "Modo claro" : "Modo noturno"}
            </button>
            <button type="button" onClick={signOut} className="flex h-[50px] items-center justify-center gap-2 rounded-xl bg-[var(--v2-bad-bg)] text-sm font-bold text-[var(--v2-bad)]">
              <LogOut className="h-[18px] w-[18px]" />
              Sair
            </button>
          </div>
        </div>
      )}

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 grid h-[68px] grid-cols-4 border-t border-[var(--v2-border)] bg-[var(--v2-bar)] px-2 pb-2.5 pt-1.5 md:hidden">
        {TABS.map((tab) => {
          const on = !menuOpen && (tab.exact ? pathname === tab.url : pathname.startsWith(tab.url));
          return (
            <Link key={tab.url} href={tab.url} aria-current={on ? "page" : undefined} className={cn("flex flex-col items-center justify-center gap-[3px] text-[11px]", on ? "font-bold text-[var(--v2-text)]" : "font-semibold text-[var(--v2-muted)]")}>
              <span className={cn("flex h-7 w-[52px] items-center justify-center rounded-full", on && "bg-[var(--v2-pill)]")}>
                <tab.icon className="h-[21px] w-[21px]" strokeWidth={1.9} />
              </span>
              {tab.title}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuPath(menuOpen ? null : pathname)}
          aria-expanded={menuOpen}
          className={cn("flex flex-col items-center justify-center gap-[3px] text-[11px]", menuOpen ? "font-bold text-[var(--v2-text)]" : "font-semibold text-[var(--v2-muted)]")}
        >
          <span className={cn("flex h-7 w-[52px] items-center justify-center rounded-full", menuOpen && "bg-[var(--v2-pill)]")}>
            {menuOpen ? <X className="h-[21px] w-[21px]" strokeWidth={1.9} /> : <Menu className="h-[21px] w-[21px]" strokeWidth={1.9} />}
          </span>
          Menu
        </button>
      </nav>
    </div>
  );
}
