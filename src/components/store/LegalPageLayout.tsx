import type { ReactNode } from "react";

type LegalSection = { heading: string; body: ReactNode[] };

export default function LegalPageLayout({
  title,
  sections,
}: {
  title: string;
  sections: LegalSection[];
}) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
      <h1 className="font-display text-3xl font-normal text-gray-900 mb-10 md:mb-14">
        {title}
      </h1>
      <div className="space-y-10 md:space-y-12">
        {sections.map((s) => (
          <div
            key={s.heading}
            className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-2 md:gap-10"
          >
            <h2 className="text-base font-medium text-gray-900">{s.heading}</h2>
            <div className="space-y-4">
              {s.body.map((paragraph, i) => (
                <p key={i} className="text-sm text-gray-600 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
