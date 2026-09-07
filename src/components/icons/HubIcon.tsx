// Custom icon (lucide doesn't have one): a molecule/hub glyph — a solid center node
// with spokes out to open circles — matches lucide's own stroke style (viewBox 24,
// currentColor, 2px rounded stroke) so it sits naturally next to the rest of the icons.
export function HubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="HUB"
    >
      <line x1="12" y1="12" x2="16" y2="5" />
      <line x1="12" y1="12" x2="5" y2="10" />
      <line x1="12" y1="12" x2="9" y2="19" />
      <line x1="12" y1="12" x2="19" y2="17" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="16" cy="5" r="2.4" />
      <circle cx="5" cy="10" r="2.4" />
      <circle cx="9" cy="19" r="2.4" />
      <circle cx="19" cy="17" r="2.4" />
    </svg>
  );
}
