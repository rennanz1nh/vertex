"use client";

import { useEffect } from "react";
import { trackPurchase } from "@/lib/facebook-pixel-events";

type Props = {
  total: number;
  itemCount: number;
  orderId?: string;
};

export default function TrackPurchase({ total, itemCount, orderId }: Props) {
  useEffect(() => {
    trackPurchase(total, itemCount, orderId);
  }, [total, itemCount, orderId]);

  return null;
}
