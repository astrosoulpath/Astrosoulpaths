"use client";

import Link from "next/link";

interface ServiceDetailPageProps {
  badge: string;
  title: string;
  description: string;
  features: string[];
  primaryButtonText: string;
  primaryButtonHref: string;
}

export default function ServiceDetailPage({
  badge,
  title,
  description,
  features,
  primaryButtonText,
  primaryButtonHref,
}: ServiceDetailPageProps) {
  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-6xl px-6">

        <p className="font-semibold uppercase tracking-[0.25em] text-[#D4AF37]">
          {badge}
        </p>

        <h1 className="mt-4 text-5xl font-bold text-[#0B1026]">
          {title}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600">
          {description}
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">

          {features.map((feature, index) => (
            <div
              key={index}
              className="rounded-2xl border border-[#EFE8D9] bg-white p-6 shadow-sm"
            >
              <div className="flex items-start gap-4">

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#D4AF37] text-white font-bold">
                  ✓
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[#0B1026]">
                    {feature}
                  </h3>
                </div>

              </div>
            </div>
          ))}

        </div>

        <div className="mt-14 flex flex-wrap gap-4">

          <Link
            href={primaryButtonHref}
            className="rounded-xl bg-[#D4AF37] px-8 py-4 font-semibold text-[#0B1026] transition hover:opacity-90"
          >
            {primaryButtonText}
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-[#D4AF37] px-8 py-4 font-semibold text-[#D4AF37]"
          >
            Back to Home
          </Link>

        </div>

      </div>
    </main>
  );
}