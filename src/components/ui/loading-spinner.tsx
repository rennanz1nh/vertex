"use client";

import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  className?: string;
}

export const LoadingSpinner = ({ className }: LoadingSpinnerProps) => {
  return (
    <video
      src="/images/loading-animation.mp4"
      autoPlay
      loop
      muted
      playsInline
      // playbackRate isn't a JSX/HTML attribute — has to be set on the element itself,
      // once its metadata is ready, to actually take effect.
      onLoadedMetadata={(e) => { e.currentTarget.playbackRate = 2; }}
      className={cn("h-16 w-16 object-contain", className)}
    />
  );
};