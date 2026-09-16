import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Hash,
  MoonStar,
  Palette,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

const horoscopeBenefits = [
  {
    icon: MoonStar,
    title: "Daily Guidance",
    description:
      "A concise Vedic reading to help you plan the day with greater clarity.",
  },
  {
    icon: Palette,
    title: "Lucky Color",
    description:
      "Discover the color associated with the day's planetary influence.",
  },
  {
    icon: Hash,
    title: "Lucky Number",
    description:
      "Receive a daily number based on your personalized astrology insights.",
  },
  {
    icon: Sparkles,
    title: "Favorable Activities",
    description:
      "Understand which activities and opportunities may be better supported.",
  },
  {
    icon: TriangleAlert,
    title: "Daily Cautions",
    description:
      "See areas where patience, planning or additional care may be helpful.",
  },
];

export function HoroscopeSubscriptionSection() {
  return (
    <section className="relative overflow-hidden bg-[#FBF8F1] py-24 sm:py-28">
      <div className="absolute -left-40 top-10 h-[32rem] w-[32rem] rounded-full bg-[#D4AF37]/10 blur-[120px]" />
      <div className="absolute -right-40 bottom-0 h-[34rem] w-[34rem] rounded-full bg-[#0B1739]/8 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <span className="inline-flex rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#A47B12]">
              Personalized Daily Horoscope
            </span>

            <h2 className="mt-5 text-3xl font-black leading-[1.08] tracking-[-0.045em] text-[#08142E] sm:text-4xl lg:text-5xl">
              Start every day with guidance made for you.
            </h2>

            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-[#667085]">
              Receive daily Vedic insights based on your saved birth details,
              including opportunities, priorities and practical cautions.
            </p>

            <div className="mt-8 rounded-[1.75rem] border border-[#E8DDBE] bg-white/90 p-6 shadow-[0_16px_45px_rgba(10,22,52,.07)] backdrop-blur sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[#7E8797]">
                    <CalendarDays className="h-4 w-4" />

                    <span className="text-xs font-black uppercase tracking-[0.16em]">
                      Daily Horoscope Plan
                    </span>
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-4xl font-black tracking-tight text-[#08142E]">
                      ₹99
                    </span>

                    <span className="pb-1 text-sm font-semibold text-[#7B8494]">
                      per month
                    </span>
                  </div>
                </div>

                <span className="rounded-full border border-[#E5D6A7] bg-[#FBF5DF] px-4 py-2 text-xs font-black text-[#8D6910]">
                  Coming Soon
                </span>
              </div>

              <p className="mt-5 text-sm font-medium leading-7 text-[#667085]">
                Personalized daily horoscope guidance linked to your saved birth
                profile.
              </p>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/subscriptions"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D7B23C] to-[#C99A1E] px-7 py-4 text-sm font-black text-[#071329] shadow-lg transition hover:-translate-y-0.5"
              >
                View Horoscope Plan
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>

              <Link
                href="/kundli"
                className="inline-flex items-center justify-center rounded-2xl border border-[#C9CFD9] bg-white/70 px-7 py-4 text-sm font-black text-[#0B1739] transition hover:border-[#D4AF37] hover:bg-white"
              >
                Create Birth Profile
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2.15rem] bg-gradient-to-br from-[#071329] via-[#0D1B3A] to-[#172750] shadow-[0_35px_85px_rgba(7,19,41,.2)]">
            <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#D4AF37]/13 blur-3xl" />

            <div className="relative border-b border-white/10 px-6 py-8 sm:px-8">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E1C14B]">
                Today&apos;s Reading Includes
              </p>

              <h3 className="mt-4 max-w-lg text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl">
                Simple insights for a more confident day.
              </h3>

              <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-white/60">
                A clear daily overview designed to make your personalized
                astrology guidance easy to understand.
              </p>
            </div>

            <div className="relative grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
              {horoscopeBenefits.map((benefit, index) => {
                const Icon = benefit.icon;

                return (
                  <article
                    key={benefit.title}
                    className={`rounded-[1.35rem] border border-white/10 bg-white/[0.06] p-5 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.1] ${
                      index === horoscopeBenefits.length - 1
                        ? "sm:col-span-2"
                        : ""
                    }`}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D4AF37]/12 text-[#E1C14B]">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>

                    <h4 className="mt-4 font-black text-white">
                      {benefit.title}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-white/55">
                      {benefit.description}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="relative border-t border-white/10 bg-white/[0.035] px-6 py-5 text-sm leading-6 text-white/55 sm:px-8">
              Birth date, birth time and birthplace are used to generate
              personalized horoscope insights.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
