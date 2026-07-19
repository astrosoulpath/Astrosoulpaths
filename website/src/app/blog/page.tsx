import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Astrology Blog | Astro Soul Path",
  description:
    "Read educational articles about Vedic astrology, Kundli, planetary transits, remedies and spiritual guidance.",
};

const categories = [
  {
    title: "Vedic Astrology",
    description:
      "Learn the fundamentals of Vedic astrology and how birth charts are interpreted.",
  },
  {
    title: "Kundli & Birth Charts",
    description:
      "Understand Kundli reports, planetary positions, Dashas and divisional charts.",
  },
  {
    title: "Planetary Transits",
    description:
      "Explore how planetary movements can influence different areas of life.",
  },
  {
    title: "Remedies",
    description:
      "Discover traditional Vedic remedies and when they may be recommended.",
  },
  {
    title: "Relationships & Marriage",
    description:
      "Articles focused on compatibility, marriage timing and relationship guidance.",
  },
  {
    title: "Career & Finance",
    description:
      "Insights into career, education, business and financial astrology.",
  },
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B58D16]">
            Knowledge Center
          </p>

          <h1 className="mt-4 text-4xl font-bold text-[#0B1026] sm:text-5xl">
            Astro Soul Path Blog
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Educational content about Vedic astrology, Kundli, remedies and
            spiritual guidance. New articles will be published regularly.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <article
              key={category.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/10 text-lg font-bold text-[#B58D16]">
                {category.title.charAt(0)}
              </div>

              <h2 className="mt-5 text-xl font-semibold text-[#0B1026]">
                {category.title}
              </h2>

              <p className="mt-3 leading-7 text-slate-600">
                {category.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[#0B1026]">
            Articles Coming Soon
          </h2>

          <p className="mt-5 leading-8 text-slate-600">
            We are preparing high-quality educational content covering Vedic
            astrology, Kundli interpretation, planetary influences and practical
            guidance for everyday life.
          </p>

          <Link
            href="/astrologers"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#B58D16] px-7 py-3 font-semibold text-white transition hover:bg-[#967311]"
          >
            Consult an Astrologer
          </Link>
        </div>
      </section>
    </main>
  );
}