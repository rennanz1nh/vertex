"use client";

import { useEffect } from "react";
import { trackSearch } from "@/lib/facebook-pixel-events";

export default function TrackSearch({ query }: { query: string }) {
  useEffect(() => {
    trackSearch(query);
  }, [query]);

  return null;
}
