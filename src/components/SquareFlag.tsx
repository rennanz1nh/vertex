// A country flag rendered inside a fixed rectangular box (object-contain), so every flag
// occupies the same footprint and lines up uniformly regardless of its native aspect ratio,
// without cropping or distortion. Used in the Pedidos table and the order form.

const LOCAL_FLAGS = new Set(["us", "br", "cn", "es", "fr", "it", "ru", "sa"]);

export function SquareFlag({ code, className = "h-4 w-6" }: { code: string; className?: string }) {
  if (!code || code.length !== 2) return <span className="text-muted-foreground">—</span>;
  const lower = code.toLowerCase();
  const src = LOCAL_FLAGS.has(lower) ? `/flags/${lower}.png` : `https://flagcdn.com/w40/${lower}.png`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={code.toUpperCase()}
      title={code.toUpperCase()}
      className={`${className} object-contain rounded-[2px] shrink-0 inline-block`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = `https://flagcdn.com/w40/${lower}.png`;
      }}
    />
  );
}
