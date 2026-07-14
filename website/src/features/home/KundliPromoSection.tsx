import Link from "next/link";

const kundliFeatures = [
  {
    icon: "🪐",
    title: "D1 Birth Chart",
    description:
      "Complete Janam Kundli with planetary positions and house analysis.",
  },
  {
    icon: "💍",
    title: "D9 Navamsa",
    description:
      "Marriage, destiny and spiritual strength analysis through Navamsa chart.",
  },
  {
    icon: "⏳",
    title: "Mahadasha",
    description:
      "Current and upcoming planetary periods affecting important life events.",
  },
  {
    icon: "✨",
    title: "Dosha Analysis",
    description:
      "Manglik, Kaal Sarp and other doshas with suggested Vedic remedies.",
  },
];

export function KundliPromoSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">

          {/* Left Side */}

          <div className="order-2 lg:order-1">
            <p className="font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Professional Kundli
            </p>

            <h2 className="mt-4 text-3xl font-bold leading-tight text-[#0B1026] sm:text-4xl lg:text-5xl">
              Generate Your Complete Vedic Kundli
            </h2>

            <p className="mt-6 text-lg leading-8 text-gray-600">
              Create your personalized Kundli using your birth
              date, birth time and birthplace. Understand your
              planetary positions, yogas, doshas and future
              predictions with detailed Vedic calculations.
            </p>

            <div className="mt-8 space-y-4">

              <div className="flex gap-4">
                <div className="mt-1 text-xl text-[#D4AF37]">
                  ✓
                </div>

                <div>
                  <h3 className="font-semibold text-[#0B1026]">
                    Accurate Birth Chart
                  </h3>

                  <p className="text-gray-600">
                    Based on exact birth details with
                    authentic Vedic calculations.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1 text-xl text-[#D4AF37]">
                  ✓
                </div>

                <div>
                  <h3 className="font-semibold text-[#0B1026]">
                    Dasha & Yogas
                  </h3>

                  <p className="text-gray-600">
                    Understand present and future
                    planetary influences.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1 text-xl text-[#D4AF37]">
                  ✓
                </div>

                <div>
                  <h3 className="font-semibold text-[#0B1026]">
                    Dosha Detection
                  </h3>

                  <p className="text-gray-600">
                    Manglik, Kaal Sarp and other
                    important doshas with remedies.
                  </p>
                </div>
              </div>

            </div>

            <Link
              href="/kundli"
              className="mt-10 inline-flex items-center rounded-xl bg-[#D4AF37] px-8 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
            >
              Generate Free Kundli
            </Link>
          </div>

          {/* Right Side */}

          <div className="order-1 lg:order-2">
            <div className="rounded-[2rem] bg-[#0B1026] p-8 shadow-2xl">

              <div className="grid gap-5 sm:grid-cols-2">

                {kundliFeatures.map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-2xl bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="text-4xl">
                      {feature.icon}
                    </div>

                    <h3 className="mt-5 text-xl font-bold text-[#0B1026]">
                      {feature.title}
                    </h3>

                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {feature.description}
                    </p>
                  </div>
                ))}

              </div>

              <div className="mt-8 rounded-2xl bg-[#D4AF37]/15 p-6 text-white">
                <p className="text-sm uppercase tracking-wider text-[#D4AF37]">
                  Included Reports
                </p>

                <p className="mt-3 text-lg font-semibold">
                  Planetary Positions • Houses • Yogas •
                  Doshas • Dasha • Remedies
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}