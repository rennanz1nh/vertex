"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value) {
      params.set("sort", e.target.value);
    } else {
      params.delete("sort");
    }
    router.push(`/products?${params.toString()}`);
  }

  return (
    <select
      defaultValue={searchParams.get("sort") || ""}
      onChange={handleChange}
      className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-black"
    >
      <option value="">Sort by</option>
      <option value="price-asc">Price: Low to High</option>
      <option value="price-desc">Price: High to Low</option>
      <option value="name">Name A–Z</option>
    </select>
  );
}
