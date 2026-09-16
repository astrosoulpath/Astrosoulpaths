import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Orbit,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const kundliFeatures = [
  {
    icon: Orbit,
    title: "D1 Birth Chart",
    description:
      "Complete Janam Kundli with planetary positions and house analysis.",
  },
  {
    icon: Sparkles,
    title: "D9 Navamsa",
    description:
      "Marriage, destiny and spiritual strength analysis through Navamsa chart.",
  },
  {
    icon: Clock3,
    title: "Mahadasha",
    description:
      "Current and upcoming planetary periods affecting important life events.",
  },
  {
    icon: ShieldCheck,
    title: "Dosha Analysis",
    description:
      "Manglik, Kaal Sarp and other doshas with suggested Vedic remedies.",
  },
];

const checks = [
  {
    title: "Accurate Birth Chart",
    text: "Based on exact birth details with authentic Vedic calculations.",
  },
  {
    title: "Dasha & Yogas",
    text: "Understand important present and future planetary influences.",
  },
  {
    title: "Dosha Detection",
    text: "Review important doshas together with relevant guidance.",
  },
];

export function KundliPromoSection() {
  return (
    <section className="relative overflow-hidden bg-white py-24 sm:py-28">
      <div className="absolute right-[-12rem] top-10 h-[34rem] w-[34rem] rounded-full bg-[#D4AF37]/8 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
          <div>
            <span className="inline-flex rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#A47B12]">
              Professional Kundli
            </span>

            <h2 className="mt-5 text-3xl font-black leading-[1.08] tracking-[-0.045em] text-[#08142E] sm:text-4xl lg:text-5xl">
              Discover your complete Vedic birth-chart story.
            </h2>

            <p className="mt-6 max-w-xl text-base font-medium leading-8 text-[#667085]">
              Generate a personalized Kundli using your birth date, exact birth
              time and birthplace, with detailed planetary calculations.
            </p>

            <div className="mt-8 space-y-5">
              {checks.map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F7EFCF]">
                    <Check className="h-4 w-4 stroke-[3] text-[#A57A0E]" />
                  </div>

                  <div>
                    <h3 className="font-black text-[#0B1739]">{item.title}</h3>

                    <p className="mt-1 text-sm font-medium leading-6 text-[#737B8C]">
                      {item.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/kundli"
              className="group mt-10 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#D7B23C] to-[#C99A1E] px-7 py-4 text-sm font-black text-[#071329] shadow-[0_14px_35px_rgba(190,142,21,.22)] transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Generate Free Kundli
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-[#D4AF37]/15 to-[#0B1739]/10 blur-2xl" />

            <div className="relative overflow-hidden rounded-[2.15rem] bg-gradient-to-br from-[#071329] via-[#0D1B3A] to-[#172750] p-6 shadow-[0_35px_80px_rgba(7,19,41,.2)] sm:p-8">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/12 blur-3xl" />

              <div className="relative grid gap-4 sm:grid-cols-2">
                {kundliFeatures.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <div
                      key={feature.title}
                      className="group rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-5 backdrop-blur transition duration-300 hover:-translate-y-1 hover:bg-white/[0.11]"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D4AF37]/12 text-[#E1C14B]">
                        <Icon className="h-5 w-5" />
                      </div>

                      <h3 className="mt-5 text-lg font-black text-white">
                        {feature.title}
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-white/60">
                        {feature.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="relative mt-5 rounded-[1.4rem] border border-[#D4AF37]/15 bg-[#D4AF37]/10 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#E1C14B]">
                  Included Reports
                </p>

                <p className="mt-2 text-sm font-bold leading-6 text-white">
                  Planetary Positions · Houses · Yogas · Doshas · Dasha ·
                  Remedies
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
