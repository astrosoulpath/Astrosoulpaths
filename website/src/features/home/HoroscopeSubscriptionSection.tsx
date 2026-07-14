import Link from "next/link";

const horoscopeBenefits = [
  {
    icon: "🌞",
    title: "Daily Guidance",
    description:
      "A concise Vedic reading to help you plan the day with greater clarity.",
  },
  {
    icon: "🎨",
    title: "Lucky Color",
    description:
      "Discover the color associated with the day’s planetary influence.",
  },
  {
    icon: "🔢",
    title: "Lucky Number",
    description:
      "Receive a daily number based on your personalized astrology insights.",
  },
  {
    icon: "✨",
    title: "Favorable Activities",
    description:
      "Understand which activities and opportunities may be better supported.",
  },
  {
    icon: "⚠️",
    title: "Daily Cautions",
    description:
      "See areas where patience, planning or additional care may be helpful.",
  },
];

export function HoroscopeSubscriptionSection() {
  return (
    <section className="relative overflow-hidden bg-[#FAF7F0] py-16 sm:py-20">
      <div
        aria-hidden="true"
        className="absolute -left-32 top-10 h-80 w-80 rounded-full bg-[#D4AF37]/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#0B1026]/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
          <div>
            <p className="font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Personalized Daily Horoscope
            </p>

            <h2 className="mt-4 text-3xl font-bold leading-tight text-[#0B1026] sm:text-4xl lg:text-5xl">
              Begin every day with personalized Vedic guidance
            </h2>

            <p className="mt-6 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
              Receive daily horoscope insights based on your birth
              details, including practical guidance for your mood,
              opportunities, priorities and cautions.
            </p>

            <div className="mt-8 rounded-3xl border border-[#D4AF37]/30 bg-white p-6 shadow-lg sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Daily Horoscope Plan
                  </p>

                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <p className="text-4xl font-bold text-[#0B1026]">
                      ₹99
                    </p>

                    <p className="pb-1 font-medium text-gray-500">
                      per month
                    </p>
                  </div>
                </div>

                <span className="rounded-full bg-[#D4AF37]/15 px-4 py-2 text-sm font-bold text-[#0B1026]">
                  Coming Soon
                </span>
              </div>

              <p className="mt-5 leading-7 text-gray-600">
                The subscription will include personalized daily
                horoscope guidance linked to your saved birth profile.
              </p>

              <p className="mt-3 text-sm leading-6 text-gray-500">
                Subscription payments and automatic renewal will be
                enabled after the payment and subscription modules are
                fully connected.
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/subscriptions"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#D4AF37] px-8 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/25 sm:w-auto"
              >
                View Horoscope Plan
              </Link>

              <Link
                href="/kundli"
                className="inline-flex w-full items-center justify-center rounded-xl border border-[#0B1026] px-8 py-4 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#0B1026]/15 sm:w-auto"
              >
                Create Birth Profile
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2rem] bg-[#0B1026] shadow-2xl">
            <div className="border-b border-white/10 px-6 py-7 sm:px-8">
              <p className="font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
                Today&apos;s Reading Includes
              </p>

              <h3 className="mt-3 text-3xl font-bold leading-tight text-white sm:text-4xl">
                Simple insights for a more confident day
              </h3>

              <p className="mt-4 max-w-2xl leading-7 text-white/65">
                Your daily reading will present useful guidance in a
                clear and easy-to-follow format.
              </p>
            </div>

            <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
              {horoscopeBenefits.map((benefit, index) => (
                <article
                  key={benefit.title}
                  className={`rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:bg-white/10 ${
                    index === horoscopeBenefits.length - 1
                      ? "sm:col-span-2"
                      : ""
                  }`}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/15 text-2xl">
                    {benefit.icon}
                  </div>

                  <h4 className="mt-4 text-lg font-bold text-white">
                    {benefit.title}
                  </h4>

                  <p className="mt-2 text-sm leading-6 text-white/65">
                    {benefit.description}
                  </p>
                </article>
              ))}
            </div>

            <div className="border-t border-white/10 bg-white/5 px-6 py-5 sm:px-8">
              <p className="text-sm leading-6 text-white/65">
                Your birth date, birth time and birthplace will be used
                to generate personalized horoscope insights.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}