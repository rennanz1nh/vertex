import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { db: { schema: (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public" } }
);

type BioLink = {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  thumbnail_url: string | null;
  description: string | null;
  button_color: string | null;
  button_text_color: string | null;
  position: number;
  enabled: boolean;
};

type BioSettings = {
  display_name: string;
  description: string | null;
  subtitle: string | null;
  avatar_url: string | null;
  background_color: string;
  background_image_url: string | null;
  text_color: string;
  accent_color: string | null;
  button_style: string;
  gradient_start: string | null;
  gradient_end: string | null;
  gradient_direction: string;
  button_shadow: string;
  button_animation: string;
  font_family: string;
  social_position: string;
};

const ICON_SVG: Record<string, { viewBox: string; path: string }> = {
  whatsapp: {
    viewBox: "0 0 24 24",
    path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
  },
  instagram: {
    viewBox: "0 0 24 24",
    path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  },
  facebook: {
    viewBox: "0 0 24 24",
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  tiktok: {
    viewBox: "0 0 24 24",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  },
  youtube: {
    viewBox: "0 0 24 24",
    path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  },
  twitter: {
    viewBox: "0 0 24 24",
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  email: {
    viewBox: "0 0 24 24",
    path: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
  },
  phone: {
    viewBox: "0 0 24 24",
    path: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
  },
  website: {
    viewBox: "0 0 24 24",
    path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
  },
  map: {
    viewBox: "0 0 24 24",
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
  },
  store: {
    viewBox: "0 0 24 24",
    path: "M18.36 9l.6 3H5.04l.6-3h12.72M20 4H4v2h16V4zm0 3H4l-1 5v2h1v6h10v-6h4v6h2v-6h1v-2l-1-5zM6 18v-4h6v4H6z",
  },
  link: {
    viewBox: "0 0 24 24",
    path: "M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z",
  },
};

const SOCIAL_ICONS = ["instagram", "facebook", "tiktok", "youtube", "twitter"];

function getBorderRadius(style: string) {
  switch (style) {
    case "pill": return "9999px";
    case "square": return "4px";
    case "outline": return "12px";
    default: return "16px";
  }
}

function getShadow(style: string, accentColor: string) {
  switch (style) {
    case "soft": return "0 4px 14px rgba(0,0,0,0.15)";
    case "medium": return "0 6px 20px rgba(0,0,0,0.25)";
    case "hard": return "0 8px 30px rgba(0,0,0,0.4)";
    case "neon": return `0 0 20px ${accentColor}66, 0 0 40px ${accentColor}33`;
    case "floating": return "0 12px 40px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)";
    default: return "none";
  }
}

function getAnimation(style: string) {
  switch (style) {
    case "fade-in": return "bio-fade-in";
    case "slide-up": return "bio-slide-up";
    case "scale": return "bio-scale-in";
    case "bounce": return "bio-bounce-in";
    default: return "";
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { data: settings } = await supabase.from("bio_settings").select("*").limit(1).maybeSingle();
  const name = settings?.display_name || "Vertex Rental Cars";
  return {
    title: `${name} | Links`,
    description: settings?.description || "Nossos links",
  };
}

export default async function LinksPage() {
  const [{ data: links }, { data: settings }] = await Promise.all([
    supabase.from("bio_links").select("*").eq("enabled", true).order("position", { ascending: true }),
    supabase.from("bio_settings").select("*").limit(1).maybeSingle(),
  ]);

  const s: BioSettings = {
    display_name: settings?.display_name || "Vertex Rental Cars",
    description: settings?.description || null,
    subtitle: settings?.subtitle || null,
    avatar_url: settings?.avatar_url || null,
    background_color: settings?.background_color || "#0f172a",
    background_image_url: settings?.background_image_url || null,
    text_color: settings?.text_color || "#ffffff",
    accent_color: settings?.accent_color || "#3b82f6",
    button_style: settings?.button_style || "rounded",
    gradient_start: settings?.gradient_start || null,
    gradient_end: settings?.gradient_end || null,
    gradient_direction: settings?.gradient_direction || "to bottom",
    button_shadow: settings?.button_shadow || "soft",
    button_animation: settings?.button_animation || "fade-in",
    font_family: settings?.font_family || "Inter",
    social_position: settings?.social_position || "bottom",
  };

  const enabledLinks = (links as BioLink[] | null) ?? [];

  const socialLinks = enabledLinks.filter((l) => l.icon && SOCIAL_ICONS.includes(l.icon));
  const mainLinks = s.social_position === "hidden"
    ? enabledLinks
    : enabledLinks.filter((l) => !socialLinks.includes(l));

  const borderRadius = getBorderRadius(s.button_style);
  const animClass = getAnimation(s.button_animation);

  const hasGradient = s.gradient_start && s.gradient_end;
  const bgStyle: React.CSSProperties = s.background_image_url
    ? {
        backgroundImage: `url(${s.background_image_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : hasGradient
    ? { background: `linear-gradient(${s.gradient_direction}, ${s.gradient_start}, ${s.gradient_end})` }
    : { backgroundColor: s.background_color };

  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(s.font_family)}:wght@400;500;600;700&display=swap`;

  const SocialBar = () =>
    socialLinks.length > 0 ? (
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {socialLinks.map((link) => {
          const iconData = link.icon ? ICON_SVG[link.icon] : null;
          if (!iconData) return null;
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              title={link.title}
              className="bio-social-icon"
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: link.button_color || `${s.text_color}15`,
                color: link.button_text_color || s.text_color,
                border: `1px solid ${s.text_color}20`,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              <svg className="w-5 h-5 fill-current" viewBox={iconData.viewBox}>
                <path d={iconData.path} />
              </svg>
            </a>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={fontUrl} />
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes bio-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bio-slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bio-scale-in {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bio-bounce-in {
          0% { opacity: 0; transform: translateY(20px); }
          60% { opacity: 1; transform: translateY(-5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bio-avatar-in {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bio-glow {
          0%, 100% { box-shadow: 0 0 20px ${s.accent_color}44; }
          50% { box-shadow: 0 0 30px ${s.accent_color}88; }
        }
        .bio-link-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .bio-link-btn:hover {
          transform: translateY(-2px) scale(1.02);
          filter: brightness(1.1);
        }
        .bio-link-btn:active {
          transform: scale(0.98);
        }
        .bio-social-icon:hover {
          transform: scale(1.15);
          filter: brightness(1.2);
        }
        .bio-social-icon:active {
          transform: scale(0.95);
        }
        ${s.button_shadow === "neon" ? `.bio-link-btn:hover { animation: bio-glow 2s ease-in-out infinite; }` : ""}
      `}} />

      <div
        className="min-h-screen"
        style={{
          ...bgStyle,
          fontFamily: `'${s.font_family}', system-ui, sans-serif`,
        }}
      >
        {s.background_image_url && (
          <div
            className="fixed inset-0"
            style={{ backgroundColor: `${s.background_color}cc` }}
          />
        )}

        <div
          className="relative min-h-screen flex flex-col items-center px-5 py-10 sm:py-14"
          style={{ color: s.text_color }}
        >
          <div className="w-full max-w-md flex flex-col items-center gap-6">
            {/* Profile Section */}
            <div
              className="flex flex-col items-center gap-3 pt-2"
              style={{ animation: "bio-avatar-in 0.6s ease-out" }}
            >
              {s.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.avatar_url}
                  alt={s.display_name}
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full object-cover"
                  style={{
                    border: `3px solid ${s.accent_color || s.text_color}`,
                    boxShadow: `0 0 30px ${s.accent_color || s.text_color}33`,
                  }}
                />
              ) : (
                <div
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center text-4xl font-bold"
                  style={{
                    backgroundColor: `${s.text_color}12`,
                    border: `3px solid ${s.accent_color || s.text_color}`,
                    color: s.text_color,
                    boxShadow: `0 0 30px ${s.accent_color || s.text_color}33`,
                  }}
                >
                  {s.display_name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="text-center">
                <h1
                  className="text-2xl sm:text-3xl font-bold tracking-tight"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {s.display_name}
                </h1>
                {s.subtitle && (
                  <p className="mt-1.5 text-sm sm:text-base opacity-70 font-medium">
                    {s.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Social Bar - Top */}
            {s.social_position === "top" && <SocialBar />}

            {/* Main Links */}
            {mainLinks.length > 0 && (
              <div className="w-full flex flex-col gap-3">
                {mainLinks.map((link, index) => {
                  const iconData = link.icon ? ICON_SVG[link.icon] : null;
                  const btnBg = link.button_color || s.accent_color || "#3b82f6";
                  const btnText = link.button_text_color || "#ffffff";
                  const isOutline = s.button_style === "outline";
                  const shadow = getShadow(s.button_shadow, btnBg);

                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`bio-link-btn flex items-center gap-4 w-full p-4 ${animClass ? animClass : ""}`}
                      style={{
                        backgroundColor: isOutline ? "transparent" : btnBg,
                        color: isOutline ? s.text_color : btnText,
                        borderRadius,
                        border: isOutline ? `2px solid ${btnBg}` : `1px solid ${btnBg}22`,
                        boxShadow: shadow,
                        animation: animClass ? `${animClass} 0.5s ease-out ${index * 0.08}s both` : undefined,
                        backdropFilter: isOutline ? "blur(10px)" : undefined,
                      }}
                    >
                      {link.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.thumbnail_url}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                      ) : iconData ? (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: isOutline ? `${btnBg}20` : "rgba(255,255,255,0.18)",
                          }}
                        >
                          <svg
                            className="w-6 h-6"
                            viewBox={iconData.viewBox}
                            style={{ fill: isOutline ? btnBg : btnText }}
                          >
                            <path d={iconData.path} />
                          </svg>
                        </div>
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: isOutline ? `${btnBg}20` : "rgba(255,255,255,0.18)",
                          }}
                        >
                          <svg
                            className="w-6 h-6"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={isOutline ? btnBg : btnText}
                            strokeWidth="2"
                          >
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-base block truncate">
                          {link.title}
                        </span>
                        {link.description && (
                          <span
                            className="text-xs block truncate mt-0.5"
                            style={{ opacity: 0.7 }}
                          >
                            {link.description}
                          </span>
                        )}
                      </div>

                      <svg
                        className="w-5 h-5 shrink-0"
                        style={{ opacity: 0.5 }}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </a>
                  );
                })}
              </div>
            )}

            {enabledLinks.length === 0 && (
              <p className="text-center opacity-50 py-12">Nenhum link disponivel.</p>
            )}

            {/* Social Bar - Bottom */}
            {s.social_position === "bottom" && <SocialBar />}

            {/* Footer */}
            <div className="mt-6 pb-6 text-center">
              <p className="text-xs opacity-25">
                Vertex Rental Cars
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
