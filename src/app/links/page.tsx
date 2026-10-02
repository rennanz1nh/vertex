import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";

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
  position: number;
  enabled: boolean;
};

type BioSettings = {
  display_name: string;
  description: string | null;
  avatar_url: string | null;
  background_color: string;
  text_color: string;
  button_style: string;
};

const ICON_MAP: Record<string, string> = {
  instagram: "📸",
  whatsapp: "💬",
  website: "🌐",
  facebook: "👤",
  tiktok: "🎵",
  youtube: "▶️",
  twitter: "𝕏",
  email: "✉️",
  phone: "📞",
  map: "📍",
  store: "🛒",
  link: "🔗",
};

export async function generateMetadata(): Promise<Metadata> {
  const { data: settings } = await supabase.from("bio_settings").select("*").limit(1).maybeSingle();
  const name = settings?.display_name || "Vertex Rental Cars";
  return {
    title: `${name} | Links`,
    description: settings?.description || "Nossos links",
  };
}

function buttonClass(style: string): string {
  const base = "flex items-center gap-3 w-full px-6 py-4 font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]";
  switch (style) {
    case "pill": return `${base} rounded-full`;
    case "square": return `${base} rounded-none`;
    case "outline": return `${base} rounded-xl bg-transparent !border-2`;
    default: return `${base} rounded-xl`;
  }
}

export default async function LinksPage() {
  const [{ data: links }, { data: settings }] = await Promise.all([
    supabase.from("bio_links").select("*").eq("enabled", true).order("position", { ascending: true }),
    supabase.from("bio_settings").select("*").limit(1).maybeSingle(),
  ]);

  const s: BioSettings = {
    display_name: settings?.display_name || "Vertex Rental Cars",
    description: settings?.description || null,
    avatar_url: settings?.avatar_url || null,
    background_color: settings?.background_color || "#000000",
    text_color: settings?.text_color || "#ffffff",
    button_style: settings?.button_style || "rounded",
  };

  const enabledLinks = (links as BioLink[] | null) ?? [];

  const btnBg = `${s.text_color}18`;
  const btnBorder = `${s.text_color}40`;
  const isOutline = s.button_style === "outline";

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-12"
      style={{ backgroundColor: s.background_color, color: s.text_color }}
    >
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        {/* Avatar */}
        {s.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={s.avatar_url}
            alt={s.display_name}
            className="w-24 h-24 rounded-full object-cover border-2"
            style={{ borderColor: `${s.text_color}30` }}
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold"
            style={{ backgroundColor: `${s.text_color}15`, color: s.text_color }}
          >
            {s.display_name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Name & description */}
        <div className="text-center">
          <h1 className="text-xl font-bold">{s.display_name}</h1>
          {s.description && (
            <p className="mt-1 text-sm opacity-70">{s.description}</p>
          )}
        </div>

        {/* Links */}
        <div className="w-full flex flex-col gap-3 mt-2">
          {enabledLinks.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass(s.button_style)}
              style={{
                backgroundColor: isOutline ? "transparent" : btnBg,
                borderColor: btnBorder,
                color: s.text_color,
              }}
            >
              {link.icon && ICON_MAP[link.icon] && (
                <span className="text-lg shrink-0">{ICON_MAP[link.icon]}</span>
              )}
              <span className="flex-1 text-center">{link.title}</span>
              <ExternalLink className="h-4 w-4 opacity-40 shrink-0" />
            </a>
          ))}

          {enabledLinks.length === 0 && (
            <p className="text-center opacity-50 py-8">Nenhum link disponível.</p>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs opacity-30">
          Vertex Rental Cars
        </p>
      </div>
    </div>
  );
}
