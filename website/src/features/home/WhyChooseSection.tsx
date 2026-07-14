const features = [
  {
    icon: "🪔",
    title: "Personalized Vedic Guidance",
    description:
      "Receive astrology predictions based on your exact birth date, birth time and birthplace instead of generic zodiac readings.",
  },
  {
    icon: "👨‍🏫",
    title: "Verified Astrologers",
    description:
      "Consult experienced and verified Vedic astrologers through secure chat and audio consultations.",
  },
  {
    icon: "📜",
    title: "Accurate Kundli Reports",
    description:
      "Generate Janam Kundli, planetary positions, doshas, remedies and detailed horoscope reports.",
  },
  {
    icon: "🔒",
    title: "100% Secure Payments",
    description:
      "Recharge your wallet securely and pay only for the consultation duration you actually use.",
  },
  {
    icon: "⚡",
    title: "Instant Consultation",
    description:
      "Connect instantly with online astrologers without waiting for long appointment queues.",
  },
  {
    icon: "🌍",
    title: "Multiple Languages",
    description:
      "Consult astrologers comfortably in Hindi, English and several regional Indian languages.",
  },
];

export function WhyChooseSection() {
  return (
    <section className="bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Why Choose Astro Soul Path
          </p>

          <h2 className="mt-4 text-3xl font-bold text-[#0B1026] md:text-5xl">
            Everything You Need For Trusted Astrology Guidance
          </h2>

          <p className="mt-6 text-lg leading-8 text-gray-600">
            Our platform combines experienced Vedic astrologers,
            secure technology and personalized guidance to help
            you make confident life decisions.
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {features.map((item) => (
            <div
              key={item.title}
              className="group rounded-3xl bg-white p-8 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-3xl transition group-hover:bg-[#D4AF37] group-hover:text-white">
                {item.icon}
              </div>

              <h3 className="mt-6 text-2xl font-bold text-[#0B1026]">
                {item.title}
              </h3>

              <p className="mt-4 leading-7 text-gray-600">
                {item.description}
              </p>

              <div className="mt-6 inline-flex items-center font-semibold text-[#D4AF37]">
                Learn More
                <span className="ml-2 transition group-hover:translate-x-1">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}