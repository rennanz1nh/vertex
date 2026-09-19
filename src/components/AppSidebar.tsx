"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, LogOut, Settings, MessageCircle, ChevronRight, Newspaper, Video, ClipboardCheck, ClipboardList, CalendarDays, CalendarClock, CheckCircle2, BarChart3, Zap, Car } from "lucide-react";
import { HubIcon } from "@/components/icons/HubIcon";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { CURRENT_VERSION } from "@/data/updates";
import { authedFetch } from "@/lib/admin-fetch";
import { supabase } from "@/integrations/supabase/client";
import { GoogleLogo, GoogleSearchConsoleLogo, GoogleCloudLogo, GoogleMerchantCenterLogo, MetaLogo, StripeLogo, BrevoLogo } from "@/components/brand-logos";

// Neutralizes SidebarMenuButton's own padding/height/icon-size defaults so navLinkClass
// (below) is the only thing controlling those on the rendered <a> — asChild/Slot just
// concatenates class strings rather than tailwind-merging them across components.
const resetButtonClass = "p-0 h-auto rounded-none [&>svg]:size-[18px]";

// Menu Lateral spec, scaled to ~90% (13px labels, ~40px min height, gap/padding shrunk
// to match) — weight 600/gray-900 when active vs 400/gray-500 inactive, border-l-4 gold flag.
function navLinkClass(isActive: boolean): string {
  return cn(
    "flex items-center gap-2.5 px-3.5 py-2.5 min-h-[40px] border-l-4 text-[13px] transition-colors",
    isActive
      ? "border-yellow-500 bg-gray-50 text-gray-900 font-semibold"
      : "border-transparent text-gray-500 font-normal hover:bg-gray-50"
  );
}

const navigation = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Carros", url: "/admin/cars", icon: Car },
  { title: "Calendário", url: "/admin/calendar", icon: CalendarClock },
  { title: "Clientes", url: "/admin/clients", icon: Users },
  { title: "Reservas", url: "/admin/bookings", icon: ClipboardList },
];

// Each platform is a single link straight into its main page — the sub-pages that used
// to be separate sidebar entries are now tabs at the top of that page (same pattern as
// Configurações/SettingsTabs), so the sidebar only needs to know the landing page and the
// path prefix that should keep this entry highlighted while on any of its tabs.
//
// eBay/Amazon/TikTok Shop automation removed — those were dropshipping/marketplace
// integrations for the old cosmetics catalog and don't apply to car rental. Google
// Shopping stays (see googleAutomations below).
const automations: { title: string; image: string; url: string; basePath: string }[] = [];

// Official Meta mark (infinity symbol) instead of the static Facebook "f" asset —
// the product is Meta Pixel, not Facebook. Rendered after the Google group below.
const facebookPixel = {
  title: "Facebook Pixel",
  Logo: MetaLogo,
  url: "/admin/automations/facebook-pixel",
  basePath: "/admin/automations/facebook-pixel",
  label: "Meta Pixel",
};

// Email Marketing (Brevo) and Stripe: same single-row pattern as Facebook Pixel
// above, just not sales-channel automations — grouped here at the end of
// Automações instead of getting their own top-level rows.
const extraAutomations = [
  { title: "Email Marketing", Logo: BrevoLogo, url: "/admin/email-marketing/overview", basePath: "/admin/email-marketing", label: "Email Marketing" },
  { title: "Stripe", Logo: StripeLogo, url: "/admin/automations/stripe", basePath: "/admin/automations/stripe", label: "Stripe" },
];

// The three Google-branded automations live under one collapsible "Google" parent entry
// instead of three separate top-level rows.
const googleAutomations = [
  {
    title: "Google Search Console",
    Logo: GoogleSearchConsoleLogo,
    url: "/admin/automations/search-console/performance",
    basePath: "/admin/automations/search-console",
  },
  {
    title: "Google Shopping",
    image: "/images/sales-channels/GoogleShopping.svg",
    url: "/admin/automations/google-shopping/sync",
    basePath: "/admin/automations/google-shopping",
  },
  {
    title: "Google Merchant Center",
    Logo: GoogleMerchantCenterLogo,
    url: "/admin/automations/google-merchant-center",
    basePath: "/admin/automations/google-merchant-center",
  },
  {
    title: "Google Cloud Console",
    Logo: GoogleCloudLogo,
    url: "/admin/automations/google-cloud/overview",
    basePath: "/admin/automations/google-cloud",
  },
];

// Social Media is its own top-level collapsible group, parallel to Automações —
// more pages (Calendar, Analytics, Automation, Settings) land under this
// same group as the rest of the Social Media MCP phases ship.
const socialMedia = [
  { title: "HUB", url: "/admin/social-media/hub", basePath: "/admin/social-media/hub", icon: HubIcon },
  { title: "HUB (Zernio)", url: "/admin/social-media/zernio-hub", basePath: "/admin/social-media/zernio-hub", icon: HubIcon },
  { title: "Vídeos", url: "/admin/social-media/videos", basePath: "/admin/social-media/videos", icon: Video },
  { title: "Aprovações", url: "/admin/social-media/pending-approval", basePath: "/admin/social-media/pending-approval", icon: ClipboardCheck },
  { title: "Calendário", url: "/admin/social-media/calendar", basePath: "/admin/social-media/calendar", icon: CalendarDays },
  { title: "Publicados", url: "/admin/social-media/published", basePath: "/admin/social-media/published", icon: CheckCircle2 },
  { title: "Analytics", url: "/admin/social-media/analytics", basePath: "/admin/social-media/analytics", icon: BarChart3 },
  { title: "Automação", url: "/admin/social-media/automation", basePath: "/admin/social-media/automation", icon: Zap },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const [unreadChats, setUnreadChats] = useState(0);

  // Mobile only: close the overlay after navigating (desktop keeps the sidebar exactly
  // as it was — open or collapsed — same as before). Delegated to a single click listener
  // instead of an onClick on every <Link>: collapsible-group triggers (Automações, Google,
  // Social Media) render as <button>s, not <a>s, so `closest('a')` only matches a real nav click.
  const handleNavClick = (e: React.MouseEvent<HTMLElement>) => {
    if (!isMobile) return;
    if (!(e.target as HTMLElement).closest("a")) return;
    setOpenMobile(false);
  };
  // null = "follow the route" (open automatically while on a Google sub-page); once the
  // user clicks the trigger, their choice wins regardless of route.
  const [googleOpenOverride, setGoogleOpenOverride] = useState<boolean | null>(null);
  const googleChildActive = googleAutomations.some((item) => pathname.startsWith(item.basePath));
  const googleOpen = googleOpenOverride ?? googleChildActive;

  // Same "follow the route until the user picks" pattern as Google, but for the whole
  // Automações group now that it's collapsible too.
  const [automationsOpenOverride, setAutomationsOpenOverride] = useState<boolean | null>(null);
  const automationsChildActive =
    automations.some((item) => pathname.startsWith(item.basePath)) ||
    googleChildActive ||
    pathname.startsWith(facebookPixel.basePath) ||
    extraAutomations.some((item) => pathname.startsWith(item.basePath));
  const automationsOpen = automationsOpenOverride ?? automationsChildActive;

  const [socialMediaOpenOverride, setSocialMediaOpenOverride] = useState<boolean | null>(null);
  const socialMediaChildActive = socialMedia.some((item) => pathname.startsWith(item.basePath));
  const socialMediaOpen = socialMediaOpenOverride ?? socialMediaChildActive;

  // Unread badge: fetch once, then let Realtime bump it whenever chat rows change, instead
  // of polling the API every 15s. Zero requests unless a message/conversation actually changes.
  useEffect(() => {
    const fetchUnread = async () => {
      const res = await authedFetch("/api/admin/chat/conversations");
      if (!res.ok) return;
      const data = await res.json();
      const total = (data.conversations ?? []).reduce((sum: number, c: { unread_count: number }) => sum + c.unread_count, 0);
      setUnreadChats(total);
    };
    fetchUnread();
    const channel = supabase
      .channel("sidebar-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => fetchUnread())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => fetchUnread())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Sidebar
      collapsible="icon"
      // Vertex brand gradient, sampled from the logo mark: strong orange at the bottom
      // fading to a barely-there blue tint at the top.
      contentStyle={{
        backgroundImage: "linear-gradient(to top, rgba(240, 149, 75, 0.85) 0%, rgba(31, 148, 188, 0.08) 100%)",
      }}
    >
      <SidebarHeader className="border-b border-accent p-0">
        <div className="h-16 px-4 flex flex-row items-center justify-center group-data-[collapsible=icon]:px-2">
          {/* Collapsed: just the mark. Expanded: mark + wordmark text (not the stacked lockup
              image — at this row height a raster of the full lockup would render too small
              to read). Swapped via CSS, not JS, so there's no layout flash. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/Small.png" alt="Vertex Rental Cars" className="w-8 h-8 shrink-0 hidden group-data-[collapsible=icon]:block" />
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/Small.png" alt="" className="w-8 h-8 shrink-0" />
            <span className="font-bold text-lg tracking-wide text-[#020b35]">VERTEX</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent onClick={handleNavClick}>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navigation.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className={resetButtonClass}>
                      <Link href={item.url} className={navLinkClass(isActive)}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Collapsible open={automationsOpen} onOpenChange={setAutomationsOpenOverride} className="group/automations">
        <SidebarGroup>
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="cursor-pointer flex items-center justify-between pr-2 hover:text-sidebar-foreground">
              <span>Automações</span>
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/automations:rotate-90" />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {automations.map((automation) => {
                const isActive = pathname.startsWith(automation.basePath);
                return (
                  <SidebarMenuItem key={automation.title}>
                    <SidebarMenuButton asChild className={resetButtonClass}>
                      {/* Same row height as every other nav item (min-h-[40px] from navLinkClass) —
                          just less vertical padding so the logo itself can be taller/more visible
                          without growing the clickable row. */}
                      <Link href={automation.url} className={cn(navLinkClass(isActive), "py-1.5")} title={automation.title}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={automation.image} alt={automation.title} className="h-9 w-24 object-contain object-left" />
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              <Collapsible asChild open={googleOpen} onOpenChange={setGoogleOpenOverride}>
                <SidebarMenuItem className="group/google">
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className={cn(resetButtonClass, "w-full")}>
                      <div className={navLinkClass(googleChildActive && !googleOpen)}>
                        <GoogleLogo className="h-6 w-6 shrink-0" />
                        <span className="text-xs font-semibold truncate flex-1 text-left">Google</span>
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/google:rotate-90" />
                      </div>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="mx-4">
                      {googleAutomations.map((item) => {
                        const isActive = pathname.startsWith(item.basePath);
                        return (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <Link href={item.url} title={item.title} className="flex items-center gap-2">
                                {"Logo" in item && item.Logo ? (
                                  <item.Logo className="h-5 w-5 shrink-0" />
                                ) : (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={"image" in item ? item.image : undefined} alt={item.title} className="h-5 w-5 object-contain object-left shrink-0" />
                                )}
                                <span className="text-xs font-medium truncate">{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem>
                <SidebarMenuButton asChild className={resetButtonClass}>
                  <Link href={facebookPixel.url} className={navLinkClass(pathname.startsWith(facebookPixel.basePath))} title={facebookPixel.title}>
                    <facebookPixel.Logo className="h-6 w-6 shrink-0" />
                    <span className="text-xs font-semibold truncate">{facebookPixel.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {extraAutomations.map((item) => {
                const isActive = pathname.startsWith(item.basePath);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className={resetButtonClass}>
                      <Link href={item.url} className={navLinkClass(isActive)} title={item.title}>
                        <item.Logo className="h-6 w-6 shrink-0" />
                        <span className="text-xs font-semibold truncate">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
        </Collapsible>

        <Collapsible open={socialMediaOpen} onOpenChange={setSocialMediaOpenOverride} className="group/social-media">
        <SidebarGroup>
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel className="cursor-pointer flex items-center justify-between pr-2 hover:text-sidebar-foreground">
              <span>Social Media</span>
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/social-media:rotate-90" />
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {socialMedia.map((item) => {
                const isActive = pathname.startsWith(item.basePath);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className={resetButtonClass}>
                      <Link href={item.url} className={navLinkClass(isActive)} title={item.title}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
        </Collapsible>

      </SidebarContent>

      <SidebarFooter className="border-t border-border" onClick={handleNavClick}>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground text-center group-data-[collapsible=icon]:hidden">
            Version {CURRENT_VERSION}
          </p>
          <Link
            href="/admin/reports/daily"
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center hover:text-foreground"
          >
            <Newspaper className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-[13px] truncate flex-1 group-data-[collapsible=icon]:hidden">Resumo Diário</span>
          </Link>
          <Link
            href="/admin/chat"
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center hover:text-foreground"
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-[13px] truncate flex-1 group-data-[collapsible=icon]:hidden">Mensagens</span>
            {unreadChats > 0 && (
              <Badge className="bg-brand text-white hover:bg-brand text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0 group-data-[collapsible=icon]:hidden">
                {unreadChats}
              </Badge>
            )}
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center hover:text-foreground"
          >
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-[13px] truncate flex-1 group-data-[collapsible=icon]:hidden">Configurações</span>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4 text-destructive" />
            <span>Sair</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
