"use client";

import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  className?: string;
}

/**
 * Vertex "V" drawing itself in from left to right (soft-edged wipe), holding, then fading
 * out to loop. Transparent PNG + CSS mask, so it sits on any background (light or dark).
 * Keyframes: `vx-loader-reveal` in globals.css.
 */
export const LoadingSpinner = ({ className }: LoadingSpinnerProps) => {
  return (
    <span role="status" aria-label="Carregando" className={cn("inline-flex h-16 w-16 items-center justify-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/vertex-v.png" alt="" className="vx-loader h-full w-full object-contain" draggable={false} />
    </span>
  );
};
