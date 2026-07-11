import Link from "next/link";

const kundliFeatures = [
  {
    title: "D1 Chart",
    description: "Your primary birth chart and planetary positions.",
  },
  {
    title: "D9 Chart",
    description: "Navamsa insights for marriage, strength and destiny.",
  },
  {
    title: "Dasha",
    description: "Major and sub-period timelines influencing your life.",
  },
  {
    title: "Dosha",
    description: "Important dosha checks with practical guidance.",
  },
];

export function KundliPromoSection() {
  return (
    <section className="bg-[#FAF7F0] py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl sm:p-10">
          <div className="grid gap-4 sm:grid-cols-2">
            {kundliFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl bg-[#FAF7F0] p-6"
              >
                <p className="text-xl font-bold text-[#0B1026]">
                  {feature.title}
                </p>

                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="font-semibold text-[#D4AF37]">
            Professional Kundli Generation
          </p>

          <h2 className="mt-3 text-4xl font-bold leading-tight text-[#0B1026]">
            Generate your detailed Vedic Kundli
          </h2>

          <p className="mt-6 max-w-2xl leading-7 text-gray-600">
            Create your Kundli using your name, date of birth, time of
            birth and place of birth. View essential Vedic insights
            including charts, planetary periods and dosha information.
          </p>

          <ul className="mt-6 space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="text-[#D4AF37]" aria-hidden="true">
                ✓
              </span>
              <span>Birth chart based on accurate birth details</span>
            </li>

            <li className="flex items-start gap-3">
              <span className="text-[#D4AF37]" aria-hidden="true">
                ✓
              </span>
              <span>D1 and D9 chart insights</span>
            </li>

            <li className="flex items-start gap-3">
              <span className="text-[#D4AF37]" aria-hidden="true">
                ✓
              </span>
              <span>Dasha and dosha analysis</span>
            </li>

            <li className="flex items-start gap-3">
              <span className="text-[#D4AF37]" aria-hidden="true">
                ✓
              </span>
              <span>Compatibility and report features in upcoming phases</span>
            </li>
          </ul>

          <Link
            href="/kundli"
            className="mt-8 inline-flex rounded-xl bg-[#D4AF37] px-8 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2"
          >
            Generate Kundli
          </Link>
        </div>
      </div>
    </section>
  );
}