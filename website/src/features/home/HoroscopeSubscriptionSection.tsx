export function HoroscopeSubscriptionSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
        <div>
          <p className="font-semibold text-[#D4AF37]">
            Personalized Daily Horoscope
          </p>

          <h2 className="mt-3 text-4xl font-bold text-[#0B1026]">
            Daily Vedic guidance based on your birth details
          </h2>

          <p className="mt-6 text-gray-600">
            Get a short, simple and personalized daily horoscope using your date
            of birth, time of birth and place of birth.
          </p>

          <div className="mt-8 rounded-3xl bg-[#FAF7F0] p-6">
            <p className="text-3xl font-bold text-[#0B1026]">$1/month</p>
            <p className="mt-2 text-gray-600">
              Automatic monthly renewal with in-app daily reading.
            </p>
          </div>

          <button className="mt-8 rounded-xl bg-[#D4AF37] px-8 py-4 font-semibold text-black">
            Start Daily Horoscope
          </button>
        </div>

        <div className="rounded-[2rem] bg-[#0B1026] p-8 text-white shadow-xl">
          <p className="text-[#D4AF37]">Today&apos;s Reading Includes</p>

          <ul className="mt-6 space-y-4 text-gray-200">
            <li>✓ Short personalized daily reading</li>
            <li>✓ Daily advice and mood of the day</li>
            <li>✓ Lucky color and lucky number</li>
            <li>✓ Favorable activities</li>
            <li>✓ Things to be careful about</li>
          </ul>
        </div>
      </div>
    </section>
  );
}