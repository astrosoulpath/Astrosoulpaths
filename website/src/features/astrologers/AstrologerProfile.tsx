export function AstrologerProfile() {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-lg">
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex h-40 w-40 items-center justify-center rounded-full bg-[#F5EED8] text-6xl font-bold text-[#0B1026]">
          A
        </div>

        <div className="flex-1">
          <h1 className="text-4xl font-bold text-[#0B1026]">
            Acharya Raj
          </h1>

          <p className="mt-2 text-lg text-[#D4AF37]">
            Vedic Astrology • Kundli • Numerology
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <p className="font-semibold">Experience</p>
              <p>12 Years</p>
            </div>

            <div>
              <p className="font-semibold">Languages</p>
              <p>Hindi, English</p>
            </div>

            <div>
              <p className="font-semibold">Rating</p>
              <p>⭐ 4.9 / 5</p>
            </div>

            <div>
              <p className="font-semibold">Consultations</p>
              <p>18,000+</p>
            </div>
          </div>

          <p className="mt-8 text-[#374151]">
            Expert in Vedic Astrology, Marriage, Career, Finance,
            Love, Health and detailed Kundli analysis.
          </p>
        </div>
      </div>
    </div>
  );
}