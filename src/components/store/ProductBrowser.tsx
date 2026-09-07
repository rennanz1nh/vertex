"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import ProductCard from "./ProductCard";
import { parsePrice } from "@/lib/utils";
import type { Product } from "@/lib/supabase";

const INITIAL = 20;
const STEP = 10;

type CategoryLink = { label: string; href: string; active?: boolean };

export default function ProductBrowser({
  products,
  categories,
}: {
  products: Product[];
  categories?: CategoryLink[];
}) {
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.Marca).filter(Boolean))] as string[],
    [products]
  );
  const priceBounds = useMemo(() => {
    const prices = products.map((p) => parsePrice(p["Valor de venda (Online)"])).filter((n) => n > 0);
    const min = prices.length ? Math.floor(Math.min(...prices)) : 0;
    const max = prices.length ? Math.ceil(Math.max(...prices)) : 0;
    return { min, max };
  }, [products]);

  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice]             = useState<number | null>(null);
  const [sort, setSort]                     = useState("");
  const [visible, setVisible]               = useState(INITIAL);
  const [showFilters, setShowFilters]       = useState(false);
  const [openSection, setOpenSection]       = useState<{ price: boolean; brand: boolean }>({
    price: false,
    brand: false,
  });

  const activeFilterCount = selectedBrands.size + (maxPrice != null ? 1 : 0);

  const filtered = useMemo(() => {
    let list = products.filter((p) => {
      if (selectedBrands.size && !selectedBrands.has(p.Marca || "")) return false;
      if (maxPrice != null && parsePrice(p["Valor de venda (Online)"]) > maxPrice) return false;
      return true;
    });
    if (sort === "price-asc")
      list = [...list].sort(
        (a, b) => parsePrice(a["Valor de venda (Online)"]) - parsePrice(b["Valor de venda (Online)"])
      );
    else if (sort === "price-desc")
      list = [...list].sort(
        (a, b) => parsePrice(b["Valor de venda (Online)"]) - parsePrice(a["Valor de venda (Online)"])
      );
    else if (sort === "name")
      list = [...list].sort((a, b) => (a["Produto Nome"] || "").localeCompare(b["Produto Nome"] || ""));
    return list;
  }, [products, selectedBrands, maxPrice, sort]);

  useEffect(() => setVisible(INITIAL), [selectedBrands, maxPrice, sort]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  function toggleBrand(b: string) {
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });
  }

  // ── Filter panel content (shared between sidebar and mobile panel) ─────────
  const FilterContent = () => (
    <>
      {categories && categories.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mb-4">
          <h4 className="text-sm font-medium text-gray-800 mb-3">Category</h4>
          <ul className="space-y-1.5 text-sm text-gray-600">
            {categories.map((cat) => (
              <li key={cat.href}>
                <Link
                  href={cat.href}
                  className={`hover:text-brand transition-colors ${
                    cat.active ? "font-semibold text-brand" : ""
                  }`}
                >
                  {cat.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Price */}
      <div className="border-t border-gray-200 pt-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setOpenSection((s) => ({ ...s, price: !s.price }))}
        >
          <h4 className="text-sm font-medium text-gray-800">Price</h4>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${openSection.price ? "rotate-180" : ""}`}
          />
        </button>
        {openSection.price && priceBounds.max > 0 && (
          <div className="mt-3">
            <input
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              value={maxPrice ?? priceBounds.max}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-brand"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>${priceBounds.min}</span>
              <span>up to ${maxPrice ?? priceBounds.max}</span>
            </div>
            {maxPrice != null && (
              <button
                onClick={() => setMaxPrice(null)}
                className="text-xs text-gray-400 underline mt-1"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Brand */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setOpenSection((s) => ({ ...s, brand: !s.brand }))}
        >
          <h4 className="text-sm font-medium text-gray-800">Brand</h4>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${openSection.brand ? "rotate-180" : ""}`}
          />
        </button>
        {openSection.brand && (
          <div className="mt-3 space-y-2">
            {brands.map((b) => (
              <label key={b} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedBrands.has(b)}
                  onChange={() => toggleBrand(b)}
                  className="accent-brand"
                />
                {b}
              </label>
            ))}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-4">

      {/* ── Mobile top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between md:hidden">
        <button
          onClick={() => setShowFilters((f) => !f)}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg border transition-all
            ${showFilters
              ? "bg-black text-white border-black"
              : "bg-white text-gray-800 border-gray-300 hover:border-black"
            }`}
        >
          {showFilters ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
          {showFilters ? "Close Filters" : "Filters"}
          {activeFilterCount > 0 && !showFilters && (
            <span className="flex items-center justify-center bg-black text-white text-[10px] font-bold rounded-full w-5 h-5">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none text-sm border border-gray-300 rounded pl-2 pr-7 py-1.5 focus:outline-none focus:border-black"
          >
            <option value="">Sort by</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name">Name A–Z</option>
          </select>
          <ChevronDown className="h-4 w-4 text-[#B8860B] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ── Mobile collapsible filter panel ────────────────────────────── */}
      {showFilters && (
        <div className="md:hidden bg-gray-50 border border-gray-200 rounded-xl p-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Filter by</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={() => { setSelectedBrands(new Set()); setMaxPrice(null); }}
                className="text-xs text-gray-400 underline"
              >
                Clear all ({activeFilterCount})
              </button>
            )}
          </div>
          <FilterContent />
        </div>
      )}

      {/* ── Desktop layout ──────────────────────────────────────────────── */}
      <div className="hidden md:block">
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className="flex items-center gap-2 mb-4 text-left"
        >
          <h3 className="text-sm font-semibold text-gray-900">Filter by</h3>
          <ChevronDown className={`h-4 w-4 text-[#B8860B] transition-transform ${showFilters ? "" : "-rotate-90"}`} />
        </button>
      </div>
      <div className="flex flex-col md:flex-row gap-6">

        {/* Desktop sidebar — collapses horizontally (no width) instead of just hiding its content */}
        {showFilters && (
          <aside className="hidden md:block w-52 shrink-0">
            <FilterContent />
          </aside>
        )}

        {/* Products */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm text-gray-500">
              {filtered.length} product{filtered.length !== 1 ? "s" : ""}
            </p>
            {/* Sort by — desktop only (mobile version is in top bar) */}
            <div className="relative hidden md:block">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="appearance-none text-sm border border-gray-300 rounded pl-2 pr-7 py-1 focus:outline-none focus:border-black"
              >
                <option value="">Sort by</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="name">Name A–Z</option>
              </select>
              <ChevronDown className="h-4 w-4 text-[#B8860B] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <p className="text-sm">No products found.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                {shown.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setVisible((v) => v + STEP)}
                    className="bg-black text-white text-sm font-medium px-8 py-3 hover:bg-brand transition-colors"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
