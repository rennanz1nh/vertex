import Image from "next/image";
import Link from "next/link";

/**
 * Editorial "Learn More about you!" section — a collage of lifestyle photos
 * with a consultation CTA, matching the Wix reference homepage.
 */
export default function LearnMoreSection() {
  return (
    <section className="max-w-[1600px] mx-auto px-4 py-12">
      <h2 className="font-display text-2xl md:text-3xl font-normal text-gray-900 text-center mb-8">
        Learn More about you!
      </h2>

      <div className="relative">
        {/* Top row: two images side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative aspect-[16/7] bg-gray-100 overflow-hidden">
            <Image
              src="/images/learn-body.jpg"
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 800px"
            />
          </div>
          <div className="relative aspect-[16/7] bg-gray-100 overflow-hidden">
            <Image
              src="/images/learn-skin.jpg"
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 800px"
            />
          </div>
        </div>

        {/* Bottom: large image offset right, text overlapping on the left */}
        <div className="grid md:grid-cols-12 md:-mt-4 mt-3 items-center">
          <div className="md:col-span-5 md:row-start-1 md:col-start-1 z-10 bg-white/0 md:pr-8 py-6">
            <h3 className="font-display text-3xl md:text-4xl font-normal text-gray-900 leading-tight mb-3">
              Know more about you, your skin, hair etc.
            </h3>
            <p className="text-sm text-gray-600 mb-5">Get a appointment with a specialist.</p>
            <Link
              href="/contact-us"
              className="inline-block bg-black text-white text-sm font-medium px-8 py-3 hover:bg-brand transition-colors"
            >
              Learn More
            </Link>
          </div>
          <div className="md:col-span-8 md:col-start-5 md:row-start-1 relative aspect-[2/1] bg-gray-100 overflow-hidden">
            <Image
              src="/images/learn-faces.jpg"
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1000px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
