const features = [
  {
    title: "Personalized Vedic Guidance",
    description:
      "Readings based on your birth details, not generic zodiac predictions.",
  },
  {
    title: "Trusted Astrologers",
    description:
      "Connect with verified astrologers for chat and audio consultations.",
  },
  {
    title: "Kundli & Reports",
    description:
      "Generate Kundli, horoscope insights, remedies and detailed reports.",
  },
];

export function WhyChooseSection() {
  return (
    <section className="bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <p className="font-semibold text-[#D4AF37]">Why Choose Us</p>
          <h2 className="mt-3 text-4xl font-bold text-[#0B1026]">
            A trusted astrology platform for modern seekers
          </h2>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((item) => (
            <div key={item.title} className="rounded-3xl bg-white p-8 shadow-lg">
              <h3 className="text-xl font-bold text-[#0B1026]">
                {item.title}
              </h3>
              <p className="mt-4 text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}