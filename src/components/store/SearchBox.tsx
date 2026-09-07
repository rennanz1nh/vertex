"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { supabase, STORE_PRODUCTS, type Product } from "@/lib/supabase";
import { getProductImage } from "@/lib/product-images";
import { formatPrice, parsePrice } from "@/lib/utils";

// Live product preview: as the user types, matching products are fetched from
// Supabase and shown in a dropdown (image + name + price). Pressing Enter goes
// to the full results page (/products?search=…).
type SearchBoxProps =
  | { mobile?: boolean; variant?: "trigger" }
  | { mobile?: false; variant: "bar"; open: boolean; onOpenChange: (open: boolean) => void };

/**
 * `variant="bar"` is the nav-triggered mode: the toggle button lives outside this
 * component (the search icon in Navigation, after "Clearance"), so open state is
 * controlled from there and this only renders the input + live results, centered
 * under the nav row instead of the trigger button's own absolute dropdown.
 */
export default function SearchBox(props: SearchBoxProps) {
  const { mobile = false } = props;
  const variant = props.variant ?? "trigger";
  const router = useRouter();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(mobile);
  const open = props.variant === "bar" ? props.open : uncontrolledOpen;
  function setOpen(value: boolean) {
    if (props.variant === "bar") props.onOpenChange(value);
    else setUncontrolledOpen(value);
  }
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // debounced live search
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from(STORE_PRODUCTS)
        .select("*")
        .ilike("Produto Nome", `%${q.trim()}%`)
        .limit(6);
      setResults(
        (data || []).filter((p) => parsePrice(p["Valor de venda (Online)"]) > 0)
      );
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Close on outside click (desktop trigger only) — skipped for "bar" since its
  // toggle button lives outside this component's DOM subtree, which would make a
  // click on that button register as "outside" and race with its own toggle.
  useEffect(() => {
    if (mobile || variant === "bar") return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, variant]);

  useEffect(() => {
    if (open && !mobile) inputRef.current?.focus();
  }, [open, mobile]);

  function submit() {
    if (q.trim()) {
      router.push(`/products?search=${encodeURIComponent(q.trim())}`);
      setOpen(false);
    }
  }

  function goTo(id: string) {
    router.push(`/products/${id}`);
    setOpen(false);
    setQ("");
  }

  const resultsPanel = (q.trim().length >= 2 || loading) && (
    <div className="border border-gray-200 bg-white shadow-lg rounded-sm overflow-hidden">
      {loading && results.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>
      ) : results.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-400">No products found.</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {results.map((p) => {
            const name = p["Produto Nome"] || "Product";
            const img = p.image_url || getProductImage(name);
            return (
              <li key={p.id}>
                <button
                  onClick={() => goTo(p.id)}
                  className="flex items-center gap-3 w-full px-3 py-2 hover:bg-gray-50 text-left"
                >
                  <span className="relative w-10 h-10 shrink-0 bg-white">
                    {img && (
                      <Image src={img} alt="" fill className="object-contain p-0.5" sizes="40px" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs text-gray-800 line-clamp-1">{name}</span>
                    <span className="block text-xs font-medium text-brand">
                      {formatPrice(parsePrice(p["Valor de venda (Online)"]))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  // Mobile: inline input + results inside the mobile menu
  if (mobile) {
    return (
      <div className="relative">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Search products..."
            className="w-full border border-gray-300 rounded pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-black"
          />
        </div>
        {resultsPanel && <div className="mt-2">{resultsPanel}</div>}
      </div>
    );
  }

  // Nav-triggered bar: no button of its own (Navigation renders the icon that
  // toggles `open`) — just the input + live results, centered under the nav row.
  if (variant === "bar") {
    if (!open) return null;
    return (
      <div ref={ref} className="w-full max-w-md mx-auto px-4">
        <div className="relative mb-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Search products..."
            className="w-full border border-gray-300 rounded pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-black bg-white"
            autoFocus
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {resultsPanel}
      </div>
    );
  }

  // Desktop: a "Search" trigger that expands an input + dropdown
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-gray-700 hover:text-black transition-colors"
      >
        <Search size={15} />
        <span>Search</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 z-50">
          <div className="relative mb-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search products..."
              className="w-full border border-gray-300 rounded pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-black bg-white"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
              >
                <X size={14} />
              </button>
            )}
          </div>
          {resultsPanel}
        </div>
      )}
    </div>
  );
}
