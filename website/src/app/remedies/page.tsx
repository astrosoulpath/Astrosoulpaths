import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Astrology Remedies | Astro Soul Path",
  description:
    "Explore personalized Vedic astrology remedies for career, relationships, finance, health, spiritual growth and planetary concerns.",
};

const remedyCategories = [
  {
    title: "Career & Business",
    description:
      "Receive personalized Vedic guidance for career delays, workplace challenges, business growth and professional decisions.",
  },
  {
    title: "Love & Relationships",
    description:
      "Consult an astrologer for relationship concerns, emotional compatibility, marriage delays and family harmony.",
  },
  {
    title: "Finance & Stability",
    description:
      "Get guidance for financial planning, business challenges, income stability and periods of unexpected expenditure.",
  },
  {
    title: "Health & Wellbeing",
    description:
      "Explore spiritual and traditional Vedic remedies intended to support wellbeing alongside appropriate professional care.",
  },
  {
    title: "Marriage & Compatibility",
    description:
      "Understand compatibility, marriage timing, relationship patterns and relevant Vedic remedies through chart analysis.",
  },
  {
    title: "Spiritual Growth",
    description:
      "Discover personalized practices such as mantra, meditation, charity and devotional routines based on astrological guidance.",
  },
];

const remedyMethods = [
  "Mantra and prayer recommendations",
  "Charity and donation guidance",
  "Meditation and spiritual practices",
  "Fasting recommendations where appropriate",
  "Gemstone guidance after chart analysis",
  "Lifestyle and behavioural suggestions",
];

export default function RemediesPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B58D16]">
            Vedic Guidance
          </p>

          <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#0B1026] sm:text-5xl">
            Personalized Astrology Remedies
          </h1>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Astrology remedies should be recommended after reviewing your birth
            chart, current planetary periods and personal circumstances.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/astrologers"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#B58D16] px-6 py-3 font-semibold text-white transition hover:bg-[#967311]"
            >
              Consult an Astrologer
            </Link>

            <Link
              href="/kundli"
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-slate-100"
            >
              Explore Kundli Services
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {remedyCategories.map((category) => (
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
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B58D16]">
              How It Works
            </p>

            <h2 className="mt-3 text-3xl font-bold text-[#0B1026]">
              Remedies based on your personal chart
            </h2>

            <p className="mt-5 leading-8 text-slate-600">
              A qualified astrologer may review your date, time and place of
              birth, planetary placements, Dasha periods and current transits
              before suggesting any remedy.
            </p>

            <p className="mt-4 leading-8 text-slate-600">
              Recommendations can differ from person to person. Astro Soul Path
              does not provide one universal remedy for every user.
            </p>
          </div>

          <div className="rounded-3xl bg-[#0B1026] p-7 text-white">
            <h2 className="text-2xl font-semibold">
              Remedies may include
            </h2>

            <ul className="mt-6 space-y-4">
              {remedyMethods.map((method) => (
                <li key={method} className="flex gap-3 text-slate-200">
                  <span
                    aria-hidden="true"
                    className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-xs font-bold text-[#0B1026]"
                  >
                    ✓
                  </span>

                  <span>{method}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-[#0B1026]">
          Important guidance
        </h2>

        <p className="mt-5 leading-8 text-slate-600">
          Astrology and spiritual remedies are intended for personal guidance.
          They are not a replacement for medical, legal, financial or mental
          health advice.
        </p>

        <Link
          href="/astrologers"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-[#B58D16] px-7 py-3 font-semibold text-white transition hover:bg-[#967311]"
        >
          Find an Astrologer
        </Link>
      </section>
    </main>
  );
}