"use client";

export default function FooterSearch() {
  return (
    <input
      type="text"
      placeholder="Enter search term"
      className="w-full border border-gray-300 bg-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-black"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const val = (e.target as HTMLInputElement).value;
          if (val.trim()) window.location.href = `/products?search=${encodeURIComponent(val)}`;
        }
      }}
    />
  );
}
