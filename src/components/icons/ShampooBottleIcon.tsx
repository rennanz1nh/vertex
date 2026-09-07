// Custom icon (lucide doesn't have one): a pump-top cosmetic bottle — body, neck,
// pump head, and a protruding actuator/nozzle — matches lucide's own stroke style
// (viewBox 24, currentColor, 2px rounded stroke) so it sits naturally next to the
// rest of the sidebar icons.
export function ShampooBottleIcon({ className }: { className?: string }) {
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
      aria-label="Produtos"
    >
      <rect x="6" y="10" width="11" height="11" rx="2" />
      <rect x="9" y="6" width="5" height="4" />
      <rect x="8" y="3" width="7" height="3" rx="1" />
      <path d="M15 4.5h2.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H16" />
    </svg>
  );
}
