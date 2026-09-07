import PageBanner from "./PageBanner";

/** Placeholder page (Courses / E-books / American FDA) matching the Wix site. */
export default function ComingSoon({
  banner,
  title,
  message = "Coming soon...",
}: {
  banner?: string;
  title: string;
  message?: string;
}) {
  return (
    <>
      {banner && <PageBanner src={banner} alt={title} />}
      <div className="max-w-[1600px] mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-2xl md:text-3xl font-normal text-gray-900 mb-4">
          {title}
        </h1>
        <p className="text-gray-400 text-sm">{message}</p>
      </div>
    </>
  );
}
