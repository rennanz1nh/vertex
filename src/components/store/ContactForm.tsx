"use client";

import { useState } from "react";

/**
 * Contact form matching the Wix site (First name, Phone, Email, Reason, Link,
 * Message, File Upload). Submissions are stored in Supabase later / wired to an
 * email service; for now it validates and shows a confirmation.
 */
export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    // TODO: wire to /api/contact (email or Supabase table)
    await new Promise((r) => setTimeout(r, 600));
    setSending(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="font-display text-xl text-gray-900 mb-2">Thank you!</p>
        <p className="text-sm text-gray-600">
          Your message has been received. We&apos;ll get back to you soon.
        </p>
      </div>
    );
  }

  const label = "block text-xs font-medium text-gray-700 mb-1";
  const field =
    "w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-brand transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>First name *</label>
          <input name="firstName" required className={field} />
        </div>
        <div>
          <label className={label}>Phone</label>
          <input name="phone" type="tel" className={field} />
        </div>
      </div>

      <div>
        <label className={label}>Email *</label>
        <input name="email" type="email" required className={field} />
      </div>

      <div>
        <label className={label}>Reason of your contact</label>
        <input name="reason" className={field} />
      </div>

      <div>
        <label className={label}>Link</label>
        <input name="link" placeholder="You can send some link for us!" className={field} />
      </div>

      <div>
        <label className={label}>Message *</label>
        <textarea name="message" required rows={5} className={field} />
      </div>

      <div>
        <label className={label}>File Upload</label>
        <input
          name="file"
          type="file"
          className="block w-full text-sm text-gray-600 file:mr-3 file:border-0 file:bg-brand file:text-white file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-brand-hover file:cursor-pointer"
        />
        <p className="text-[11px] text-gray-400 mt-1">
          send more about you, your products or something else (if applicable)
        </p>
      </div>

      <button
        type="submit"
        disabled={sending}
        className="bg-black text-white text-sm font-medium px-10 py-2.5 hover:bg-gray-800 transition-colors disabled:opacity-60"
      >
        {sending ? "Sending…" : "Submit"}
      </button>
    </form>
  );
}
