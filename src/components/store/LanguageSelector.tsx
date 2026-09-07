"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// Same languages/flags as the Wix reference site. `code` is the Google
// Translate target code; `flag` points to /public/flags.
const LANGS = [
  { code: "en", label: "English", flag: "/flags/us.png" },
  { code: "es", label: "Español", flag: "/flags/es.png" },
  { code: "zh-CN", label: "中文", flag: "/flags/cn.png" },
  { code: "ar", label: "العربية", flag: "/flags/sa.png" },
  { code: "pt", label: "Português", flag: "/flags/br.png" },
  { code: "fr", label: "Français", flag: "/flags/fr.png" },
  { code: "it", label: "Italiano", flag: "/flags/it.png" },
  { code: "ru", label: "Русский", flag: "/flags/ru.png" },
];

function currentCode(): string {
  if (typeof document === "undefined") return "en";
  const m = document.cookie.match(/googtrans=\/[^/]*\/([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "en";
}

function applyLanguage(code: string) {
  const host = location.hostname;
  // clear any existing cookie variants first
  const expire = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = `googtrans=;path=/;${expire}`;
  document.cookie = `googtrans=;path=/;domain=${host};${expire}`;
  document.cookie = `googtrans=;path=/;domain=.${host};${expire}`;

  if (code !== "en") {
    const val = `/en/${code}`;
    document.cookie = `googtrans=${val};path=/`;
    document.cookie = `googtrans=${val};path=/;domain=${host}`;
    document.cookie = `googtrans=${val};path=/;domain=.${host}`;
  }
  location.reload();
}

export default function LanguageSelector() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("en");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setCode(currentCode()), []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = LANGS.find((l) => l.code === code) || LANGS[0];

  return (
    <div ref={ref} className="relative" translate="no">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-black"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.flag} alt="" className="w-5 h-auto rounded-sm" />
        <span>{current.label}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-sm py-1 z-50 min-w-[150px]">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => applyLanguage(l.code)}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${
                l.code === code ? "text-brand font-medium" : "text-gray-700"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.flag} alt="" className="w-5 h-auto rounded-sm" />
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
