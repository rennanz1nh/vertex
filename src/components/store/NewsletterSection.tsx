"use client";

import { useState } from "react";
import Image from "next/image";

export default function NewsletterSection() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !agreed) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error("Subscription failed");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="w-full">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-2">
        {/* Left: Form */}
        <div className="flex flex-col justify-center px-6 md:px-16 py-14 md:py-20 bg-white">
          {submitted ? (
            <div>
              <h2 className="font-serif text-2xl md:text-3xl font-light text-gray-900 mb-2">
                Thank you!
              </h2>
              <p className="text-gray-600 text-sm">
                You&apos;re on the list — we&apos;ll email you about rental deals and new fleet arrivals.
              </p>
            </div>
          ) : (
            <>
              <h2 className="font-serif text-2xl md:text-3xl font-light text-gray-900 leading-snug mb-1">
                Subscribe for exclusive deals
              </h2>
              <p className="text-sm text-gray-600 mb-6">Rental discounts and new fleet updates, straight to your inbox</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-black"
                />
                <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="mt-0.5 accent-black"
                  />
                  Yes, Subscribe me to your newsletter.
                </label>
                {error && <p className="text-xs text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-black text-white text-sm py-2.5 px-6 font-medium hover:bg-gray-800 transition-colors self-start disabled:opacity-60"
                >
                  {submitting ? "Subscribing..." : "Subscribe"}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Right: fleet photo */}
        <div className="relative h-64 md:h-auto">
          <Image
            src="/images/subscribe.jpg"
            alt="Vertex Rental Cars"
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      </div>
    </section>
  );
}
