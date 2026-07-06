export function KundliPromoSection() {
  return (
    <section className="bg-[#FAF7F0] py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
        <div className="rounded-[2rem] bg-white p-8 shadow-xl">
          <div className="grid grid-cols-2 gap-4">
            {["D1 Chart", "D9 Chart", "Dasha", "Dosha"].map((item) => (
              <div
                key={item}
                className="rounded-2xl bg-[#FAF7F0] p-6 text-center font-bold text-[#0B1026]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="font-semibold text-[#D4AF37]">
            Professional Kundli Generation
          </p>

          <h2 className="mt-3 text-4xl font-bold text-[#0B1026]">
            Generate detailed Vedic Kundli and reports
          </h2>

          <p className="mt-6 text-gray-600">
            Create Kundli using name, date of birth, time of birth and place of
            birth. Future phases will include PDF reports, D1, D9, Dasha,
            Dosha, Yogas and compatibility reports.
          </p>

          <button className="mt-8 rounded-xl bg-[#D4AF37] px-8 py-4 font-semibold text-black">
            Generate Kundli
          </button>
        </div>
      </div>
    </section>
  );
}