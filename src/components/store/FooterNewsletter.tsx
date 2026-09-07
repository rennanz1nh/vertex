"use client";

import { useState } from "react";

export default function FooterNewsletter() {
  const [submitted, setSubmitted] = useState(false);

  return submitted ? (
    <p className="text-xs text-gray-600">Thanks for subscribing!</p>
  ) : (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="flex flex-col gap-2"
    >
      <input
        type="email"
        required
        placeholder="Enter your email"
        className="border border-gray-300 bg-white rounded px-3 py-1.5 text-sm focus:outline-none focus:border-black"
      />
      <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" required className="mt-0.5 accent-black" />
        Yes, Subscribe me to your newsletter.
      </label>
      <button
        type="submit"
        className="bg-black text-white text-xs py-2 px-4 font-medium hover:bg-gray-800 transition-colors self-start"
      >
        Subscribe
      </button>
    </form>
  );
}
