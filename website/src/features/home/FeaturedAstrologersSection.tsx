const astrologers = [
  {
    name: "Acharya Raj",
    speciality: "Vedic Astrology",
    rating: "4.9",
    experience: "12 Years",
    languages: "Hindi, English",
    price: "₹25/min",
  },
  {
    name: "Astro Meera",
    speciality: "Tarot & Numerology",
    rating: "4.8",
    experience: "9 Years",
    languages: "Hindi",
    price: "₹20/min",
  },
  {
    name: "Pandit Aman",
    speciality: "Kundli Expert",
    rating: "4.9",
    experience: "15 Years",
    languages: "Hindi, Gujarati",
    price: "₹30/min",
  },
];

export function FeaturedAstrologersSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 flex items-center justify-between">
          <div>
            <p className="font-semibold text-[#D4AF37]">
              Featured Astrologers
            </p>

            <h2 className="mt-2 text-4xl font-bold text-[#0B1026]">
              Talk to India's Top Astrologers
            </h2>
          </div>

          <button className="rounded-xl border border-[#0B1026] px-6 py-3 font-semibold">
            View All
          </button>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {astrologers.map((astro) => (
            <div
              key={astro.name}
              className="rounded-3xl border bg-white p-8 shadow-lg transition hover:-translate-y-2"
            >
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#D4AF37]/20 text-3xl font-bold text-[#0B1026]">
                {astro.name.charAt(0)}
              </div>

              <h3 className="text-2xl font-bold">{astro.name}</h3>

              <p className="mt-2 text-gray-500">{astro.speciality}</p>

              <div className="mt-6 space-y-2 text-sm">
                <p>⭐ {astro.rating}</p>
                <p>🧿 {astro.experience}</p>
                <p>🌐 {astro.languages}</p>
                <p className="font-semibold text-[#D4AF37]">
                  {astro.price}
                </p>
              </div>

              <button className="mt-8 w-full rounded-xl bg-[#D4AF37] py-3 font-semibold">
                Chat Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}