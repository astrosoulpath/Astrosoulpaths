const services = [
  {
    title: "Chat Consultation",
    description: "Connect with verified astrologers through secure chat.",
    icon: "💬",
  },
  {
    title: "Audio Call",
    description: "Talk directly with astrologers for personal guidance.",
    icon: "📞",
  },
  {
    title: "Free Kundli",
    description: "Generate Kundli using date, time and place of birth.",
    icon: "🔮",
  },
  {
    title: "Daily Horoscope",
    description: "Personalized Vedic horoscope based on birth details.",
    icon: "🌙",
  },
  {
    title: "Remedies",
    description: "Get practical remedies for love, career, health and finance.",
    icon: "🪔",
  },
  {
    title: "Numerology",
    description: "Understand your numbers and life path with expert guidance.",
    icon: "🔢",
  },
];

export function ServicesSection() {
  return (
    <section className="bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="font-semibold text-[#D4AF37]">Our Services</p>

        <h2 className="mt-3 max-w-2xl text-4xl font-bold text-[#0B1026]">
          Everything you need for spiritual and Vedic guidance
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.title}
              className="rounded-3xl bg-white p-8 shadow-lg transition hover:-translate-y-2"
            >
              <div className="text-4xl">{service.icon}</div>

              <h3 className="mt-6 text-xl font-bold text-[#0B1026]">
                {service.title}
              </h3>

              <p className="mt-4 text-gray-600">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}