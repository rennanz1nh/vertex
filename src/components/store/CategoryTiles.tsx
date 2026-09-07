import Link from "next/link";
import Image from "next/image";

const categories = [
  { label: "Skin", href: "/products?category=womens-skin", image: "/images/category-skin.jpg" },
  { label: "Hair", href: "/products?category=womens-hair", image: "/images/category-hair.jpg" },
  { label: "Body", href: "/products?category=womens-body", image: "/images/category-body.jpg" },
  { label: "Men", href: "/products?category=men", image: "/images/category-men.jpg" },
];

export default function CategoryTiles() {
  return (
    <section className="max-w-[1600px] mx-auto px-4 py-12">
      <h2 className="font-serif text-2xl md:text-3xl font-light text-gray-900 text-center mb-8">
        Shop by Category
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
