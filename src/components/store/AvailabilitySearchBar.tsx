"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, CalendarDays } from "lucide-react";

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export default function AvailabilitySearchBar({
  defaultPickupDate,
  defaultPickupTime,
  defaultReturnDate,
  defaultReturnTime,
}: {
  defaultPickupDate?: string;
  defaultPickupTime?: string;
  defaultReturnDate?: string;
  defaultReturnTime?: string;
}) {
  const router = useRouter();
  const [pickupDate, setPickupDate] = useState(defaultPickupDate || defaultDate(1));
  const [pickupTime, setPickupTime] = useState(defaultPickupTime || "10:00");
  const [returnDate, setReturnDate] = useState(defaultReturnDate || defaultDate(4));
  const [returnTime, setReturnTime] = useState(defaultReturnTime || "10:00");
  const [error, setError] = useState<string | null>(null);

  function handleSearch() {
    setError(null);
    if (!pickupDate || !returnDate) {
      setError("Please choose both pick-up and drop-off dates.");
      return;
    }
    const pickup = new Date(`${pickupDate}T${pickupTime}`);
    const ret = new Date(`${returnDate}T${returnTime}`);
    if (ret.getTime() <= pickup.getTime()) {
      setError("Drop-off must be after pick-up.");
      return;
    }
    const params = new URLSearchParams({ pickupDate, pickupTime, returnDate, returnTime });
    router.push(`/products?${params.toString()}`);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
        {/* Location — fixed, Orlando only */}
        <div className="flex items-center gap-2.5 px-4 py-3 lg:flex-1 lg:min-w-0">
          <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-gray-400 leading-none mb-1">Pick-up</p>
            <p className="text-sm font-medium text-gray-900 truncate">Orlando, FL</p>
          </div>
        </div>

        {/* Pick-up date + time */}
        <div className="flex items-center gap-2.5 px-4 py-3 lg:flex-1 lg:min-w-0">
          <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 leading-none mb-1">Pick-up date</p>
            <input
              type="date"
              lang="en-US"
              value={pickupDate}
              min={defaultDate(0)}
              onChange={(e) => setPickupDate(e.target.value)}
              className="text-sm font-medium text-gray-900 border-0 p-0 w-full bg-transparent focus:outline-none focus:ring-0"
            />
          </div>
          <div className="w-[76px] shrink-0 border-l border-gray-200 pl-2.5">
            <p className="text-[11px] text-gray-400 leading-none mb-1">Time</p>
            <input
              type="time"
              lang="en-US"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="text-sm font-medium text-gray-900 border-0 p-0 w-full bg-transparent focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Drop-off date + time */}
        <div className="flex items-center gap-2.5 px-4 py-3 lg:flex-1 lg:min-w-0">
          <CalendarDays className="h-4 w-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 leading-none mb-1">Drop-off date</p>
            <input
              type="date"
              lang="en-US"
              value={returnDate}
              min={pickupDate || defaultDate(0)}
              onChange={(e) => setReturnDate(e.target.value)}
              className="text-sm font-medium text-gray-900 border-0 p-0 w-full bg-transparent focus:outline-none focus:ring-0"
            />
          </div>
          <div className="w-[76px] shrink-0 border-l border-gray-200 pl-2.5">
            <p className="text-[11px] text-gray-400 leading-none mb-1">Time</p>
            <input
              type="time"
              lang="en-US"
              value={returnTime}
              onChange={(e) => setReturnTime(e.target.value)}
              className="text-sm font-medium text-gray-900 border-0 p-0 w-full bg-transparent focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Search */}
        <div className="p-2.5 lg:flex lg:items-center">
          <button
            type="button"
            onClick={handleSearch}
            className="w-full lg:w-auto bg-black text-white text-sm font-medium px-8 py-2.5 rounded-md hover:bg-brand transition-colors"
          >
            Search
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 px-4 pb-3">{error}</p>}
    </div>
  );
}
