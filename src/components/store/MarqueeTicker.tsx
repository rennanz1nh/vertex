export default function MarqueeTicker() {
  const text = "Shop Sale  •  Up to 70% off  •  ";
  const repeated = text.repeat(10);

  return (
    // White background, large black League Spartan text, 1px black divider
    // below — matching the Wix reference "70% off" ticker.
    <div className="mx-auto w-full max-w-[1600px] border-b border-black overflow-hidden py-3">
      <div className="flex whitespace-nowrap animate-marquee">
        <span className="font-display text-3xl md:text-4xl font-normal text-black">
          {repeated}
        </span>
        <span className="font-display text-3xl md:text-4xl font-normal text-black" aria-hidden>
          {repeated}
        </span>
      </div>
    </div>
  );
}
