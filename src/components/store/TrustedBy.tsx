import Image from "next/image";

const partners = [
  { src: "/partners/partner-nuc.png", alt: "NUC Florida Technical College", w: 340, h: 92 },
  { src: "/partners/partner-mhb.png", alt: "Medcap Health & Beauty Institute", w: 300, h: 64 },
  { src: "/partners/partner-studioblue.png", alt: "Studio Blue Salon Suites", w: 100, h: 96 },
];

export default function TrustedBy() {
  return (
    <section className="py-12 px-4 border-t border-gray-100">
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-center gap-8 md:gap-20">
        <p className="text-gray-500 text-xl md:text-2xl font-light whitespace-nowrap">
          Trusted by:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-12 md:gap-24">
          {partners.map((p) => (
            <Image
              key={p.src}
              src={p.src}
              alt={p.alt}
              width={p.w}
              height={p.h}
              style={{ height: p.h, width: "auto" }}
              className="object-contain"
            />
          ))}

          {/* Affinity Hair Academy */}
          <div className="bg-white flex flex-col items-center leading-none select-none" style={{ height: 64 }}>
            <span className="text-[10px] font-light tracking-[0.25em] text-gray-600 uppercase">
              AFFINITY HAIR
            </span>
            <div className="bg-black px-4 py-1 mt-1">
              <span className="text-white font-bold tracking-[0.2em] text-lg uppercase">
                ACADEMY
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
