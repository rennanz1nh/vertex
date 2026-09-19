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
    <div className="bg-[#e4f2f7] border border-[#b1dae8] rounded-lg shadow-sm lg:max-w-[1080px] lg:mx-auto">
      <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[#b1dae8]">
        {/* Location — fixed, Orlando only */}
        <div className="px-5 py-3.5 lg:py-6 lg:flex-1 lg:min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
            <p className="text-[11px] text-gray-500 leading-none">Pick-up</p>
          </div>
          <p className="text-sm font-medium text-gray-900 truncate pl-6">Orlando, FL</p>
        </div>

        {/* Pick-up date + time */}
        <div className="px-5 py-3.5 lg:py-6 lg:flex-1 lg:min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <CalendarDays className="h-4 w-4 text-gray-500 shrink-0" />
            <p className="text-[11px] text-gray-500 leading-none">Pick-up date</p>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <input
              type="date"
              lang="en-US"
              value={pickupDate}
              min={defaultDate(0)}
              onChange={(e) => setPickupDate(e.target.value)}
              className="text-sm font-medium text-gray-900 border-0 p-0 bg-transparent focus:outline-none focus:ring-0"
            />
            <span className="text-gray-300">&middot;</span>
            <input
              type="time"
              lang="en-US"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="text-sm font-medium text-gray-900 border-0 p-0 bg-transparent focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Drop-off date + time */}
        <div className="px-5 py-3.5 lg:py-6 lg:flex-1 lg:min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <CalendarDays className="h-4 w-4 text-gray-500 shrink-0" />
            <p className="text-[11px] text-gray-500 leading-none">Drop-off date</p>
          </div>
          <div className="flex items-center gap-2 pl-6">
            <input
              type="date"
              lang="en-US"
              value={returnDate}
              min={pickupDate || defaultDate(0)}
              onChange={(e) => setReturnDate(e.target.value)}
              className="text-sm font-medium text-gray-900 border-0 p-0 bg-transparent focus:outline-none focus:ring-0"
            />
            <span className="text-gray-300">&middot;</span>
            <input
              type="time"
              lang="en-US"
              value={returnTime}
              onChange={(e) => setReturnTime(e.target.value)}
              className="text-sm font-medium text-gray-900 border-0 p-0 bg-transparent focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Search */}
        <div className="p-3 lg:flex lg:items-center">
          <button
            type="button"
            onClick={handleSearch}
            className="w-full lg:w-auto bg-black text-white text-sm font-medium px-8 py-3 lg:py-4 rounded-md hover:bg-brand transition-colors"
          >
            Search
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 px-5 pb-3">{error}</p>}
    </div>
  );
}
