import Link from "next/link";

type FeatureItem = {
  title: string;
  description: string;
  href: string;
  icon: string;
};

const features: FeatureItem[] = [
  {
    title: "Personalized Vedic Guidance",
    description:
      "Receive astrology guidance based on your birth details, planetary positions and individual life goals.",
    href: "/services/vedic-guidance",
    icon: "🪔",
  },
  {
    title: "Verified Astrologers",
    description:
      "Connect with approved and verified astrologers across different areas of expertise.",
    href: "/astrologers",
    icon: "👨‍🏫",
  },
  {
    title: "Accurate Kundli Reports",
    description:
      "Generate detailed Janam Kundli reports with planetary positions, dashas, yogas and doshas.",
    href: "/services/kundli-reports",
    icon: "📜",
  },
  {
    title: "100% Secure Payments",
    description:
      "Recharge your wallet and pay for consultations through a safe and transparent payment flow.",
    href: "/services/secure-payments",
    icon: "🔒",
  },
  {
    title: "Instant Consultation",
    description:
      "Find available astrologers and start a chat or audio consultation through a simple booking flow.",
    href: "/astrologers",
    icon: "⚡",
  },
  {
    title: "Multiple Languages",
    description:
      "Choose astrologers who communicate in Hindi, English and other supported languages.",
    href: "/services/multiple-languages",
    icon: "🌍",
  },
];

export function FeaturesSection() {
  return (
    <section className="bg-[#FAF7F0] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#D4AF37]">
            Why Astro Soul Path
          </p>

          <h2 className="mt-4 text-3xl font-extrabold text-[#0B1026] sm:text-4xl lg:text-5xl">
            Everything You Need for Trusted Astrology Guidance
          </h2>

          <p className="mt-5 text-base leading-7 text-gray-600 sm:text-lg">
            Explore personalized astrology services, verified
            astrologers, secure consultations and detailed reports
            through one trusted platform.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              aria-label={`Learn more about ${feature.title}`}
              className="group flex min-h-[300px] cursor-pointer flex-col rounded-3xl border border-[#E9E1D1] bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#D4AF37] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F5EED8] text-2xl transition group-hover:bg-[#D4AF37]">
                {feature.icon}
              </div>

              <h3 className="mt-6 text-2xl font-extrabold text-[#0B1026]">
                {feature.title}
              </h3>

              <p className="mt-4 flex-1 text-base leading-7 text-gray-600">
                {feature.description}
              </p>

              <span className="mt-7 inline-flex items-center gap-2 font-bold text-[#D4AF37] transition group-hover:gap-3 group-hover:text-[#B58E19]">
                Learn More
                <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}