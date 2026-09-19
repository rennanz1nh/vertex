// Floating WhatsApp button, stacked directly above the ChatWidget's "Contact Us" pill
// (both fixed bottom-right). Configured in Admin > Configurações > Google > Negócio —
// renders nothing until a number is set there.
export default function WhatsAppButton({ phoneNumber }: { phoneNumber: string | null | undefined }) {
  const digits = (phoneNumber || "").replace(/\D/g, "");
  if (!digits) return null;

  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 right-5 z-[80] bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-transform hover:scale-105"
      aria-label="Chat with us on WhatsApp"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.004 2.667c-7.363 0-13.333 5.97-13.333 13.333 0 2.353.615 4.56 1.694 6.475L2.667 29.333l7.03-1.845a13.26 13.26 0 006.307 1.606h.006c7.362 0 13.333-5.97 13.333-13.333 0-3.56-1.387-6.907-3.906-9.427a13.246 13.246 0 00-9.433-3.667zm0 24.4h-.005a11.07 11.07 0 01-5.638-1.543l-.404-.24-4.173 1.095 1.114-4.068-.264-.418a11.05 11.05 0 01-1.695-5.893c0-6.115 4.977-11.09 11.094-11.09a11.03 11.03 0 017.847 3.253 11.03 11.03 0 013.244 7.845c0 6.116-4.977 11.06-11.12 11.06zm6.085-8.287c-.334-.167-1.97-.972-2.275-1.083-.305-.111-.527-.167-.75.167-.222.334-.86 1.083-1.054 1.305-.194.223-.389.25-.722.084-.334-.167-1.41-.52-2.686-1.658-.993-.886-1.664-1.98-1.858-2.314-.194-.334-.02-.514.147-.68.15-.15.334-.39.5-.585.167-.194.223-.334.334-.556.111-.223.056-.417-.028-.584-.083-.167-.75-1.807-1.028-2.475-.27-.65-.545-.562-.75-.573-.194-.01-.417-.012-.64-.012-.222 0-.583.083-.888.417-.305.334-1.166 1.14-1.166 2.78s1.194 3.226 1.36 3.448c.167.223 2.349 3.585 5.69 5.028.795.343 1.415.548 1.898.702.797.253 1.523.217 2.097.132.64-.095 1.97-.805 2.248-1.583.278-.778.278-1.445.194-1.584-.083-.14-.305-.223-.638-.39z" />
    </svg>
  );
}
