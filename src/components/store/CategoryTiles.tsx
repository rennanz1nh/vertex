import Link from "next/link";
import Image from "next/image";

const categories = [
  { label: "Compact", href: "/products?category=compact", image: "/images/category-compact.jpg" },
  { label: "Big Van", href: "/products?category=big-van", image: "/images/category-big-van.jpg" },
  { label: "Luxe", href: "/products?category=luxe", image: "/images/category-luxe.jpg" },
  { label: "Sport", href: "/products?category=sport", image: "/images/category-sport.jpg" },
];

export default function CategoryTiles() {
  return (
    <section className="max-w-[1600px] mx-auto px-4 py-12">
      <h2 className="font-serif text-2xl md:text-3xl font-light text-gray-900 text-center mb-8">
        Rent by Category
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <Link key={cat.label} href={cat.href} className="group relative aspect-[3/4] overflow-hidden bg-gray-100">
            <Image
              src={cat.image}
              alt={cat.label}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 1024px) 50vw, 25vw"
            />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
            <div className="absolute inset-0 flex items-end justify-center pb-6">
              <span className="text-white text-lg font-medium tracking-wide drop-shadow-md border-b border-white pb-0.5">
                {cat.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
