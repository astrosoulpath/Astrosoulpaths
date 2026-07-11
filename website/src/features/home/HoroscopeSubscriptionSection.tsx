import Link from "next/link";

export function HoroscopeSubscriptionSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-2">
        <div>
          <p className="font-semibold text-[#D4AF37]">
            Personalized Daily Horoscope
          </p>

          <h2 className="mt-3 text-4xl font-bold leading-tight text-[#0B1026]">
            Daily Vedic guidance based on your birth details
          </h2>

          <p className="mt-6 max-w-2xl leading-7 text-gray-600">
            Receive a short and personalized daily horoscope based on
            your date, time and place of birth. Get practical guidance
            for your mood, activities, opportunities and cautions for
            the day.
          </p>

          <div className="mt-8 rounded-3xl bg-[#FAF7F0] p-6">
            <div className="flex flex-wrap items-end gap-2">
              <p className="text-3xl font-bold text-[#0B1026]">
                ₹99
              </p>

              <p className="pb-1 font-medium text-gray-500">
                / month
              </p>
            </div>

            <p className="mt-3 text-gray-600">
              Daily personalized Vedic horoscope with automatic
              monthly renewal.
            </p>

            <p className="mt-2 text-sm text-gray-500">
              You will be able to manage or cancel the subscription
              from your account.
            </p>
          </div>

          <Link
            href="/horoscope"
            className="mt-8 inline-flex rounded-xl bg-[#D4AF37] px-8 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2"
          >
            Start Daily Horoscope
          </Link>
        </div>

        <div className="rounded-[2rem] bg-[#0B1026] p-8 text-white shadow-xl sm:p-10">
          <p className="font-semibold text-[#D4AF37]">
            Today&apos;s Reading Includes
          </p>

          <h3 className="mt-3 text-3xl font-bold">
            Simple guidance for a more confident day
          </h3>

          <ul className="mt-8 space-y-5 text-gray-200">
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 text-[#D4AF37]"
              >
                ✓
              </span>

              <span>Short personalized daily Vedic reading</span>
            </li>

            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 text-[#D4AF37]"
              >
                ✓
              </span>

              <span>Daily advice and mood of the day</span>
            </li>

            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 text-[#D4AF37]"
              >
                ✓
              </span>

              <span>Lucky color and lucky number</span>
            </li>

            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 text-[#D4AF37]"
              >
                ✓
              </span>

              <span>Favorable activities and opportunities</span>
            </li>

            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 text-[#D4AF37]"
              >
                ✓
              </span>

              <span>Things to be careful about during the day</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}