import Link from "next/link";

import { Button } from "@/components/ui/Button";

const heroHighlights = [
  "Verified astrologers",
  "Secure chat & audio calls",
  "Personalized Kundli insights",
];

export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden bg-[#FAF7F0]"
      aria-labelledby="hero-heading"
    >
      <div
        aria-hidden="true"
        className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-[#D4AF37]/10 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-[#0B1026]/10 blur-3xl"
      />

      <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-24">
        <div>
          <span className="inline-flex items-center rounded-full border border-[#D4AF37]/30 bg-white px-4 py-2 text-sm font-semibold text-[#0B1026] shadow-sm">
            ✨ Welcome to Astro Soul Path
          </span>

          <h1
            id="hero-heading"
            className="mt-6 max-w-4xl text-4xl font-bold leading-[1.08] text-[#0B1026] sm:text-5xl md:text-6xl lg:text-7xl"
          >
            Discover clarity with trusted{" "}
            <span className="text-[#B18D19]">
              Vedic astrologers
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg sm:leading-8">
            Get personalized horoscope guidance,
            Kundli insights, remedies, secure chat
            consultations, audio calls and spiritual
            support based on authentic Vedic astrology.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {heroHighlights.map((highlight) => (
              <span
                key={highlight}
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-100"
              >
                ✓ {highlight}
              </span>
            ))}
          </div>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <Link
              href="/astrologers"
              prefetch
              className="w-full sm:w-auto"
            >
              <Button className="w-full sm:w-auto">
                Talk to an Astrologer
              </Button>
            </Link>

            <Link
              href="/kundli"
              prefetch
              className="w-full sm:w-auto"
            >
              <Button
                variant="outline"
                className="w-full sm:w-auto"
              >
                Create Free Kundli
              </Button>
            </Link>
          </div>

          <div className="mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <p className="text-2xl font-bold text-[#0B1026]">
                24/7
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Consultation access
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <p className="text-2xl font-bold text-[#0B1026]">
                Secure
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Wallet and call flow
              </p>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <p className="text-2xl font-bold text-[#0B1026]">
                Personal
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Guidance for your birth chart
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[2rem] border border-white/60 bg-white/90 p-4 shadow-2xl backdrop-blur sm:p-6">
            <div className="rounded-[1.6rem] bg-gradient-to-br from-[#0B1026] via-[#151D3D] to-[#26325E] p-6 text-white sm:p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
                    Today's Guidance
                  </p>

                  <p className="mt-1 text-xs text-white/60">
                    Personalized Vedic insight
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
                  ✦
                </div>
              </div>

              <h2 className="mt-8 text-3xl font-bold sm:text-4xl">
                Your path becomes clearer when your
                birth chart speaks.
              </h2>

              <p className="mt-5 leading-7 text-gray-300">
                Understand your strengths,
                relationships, timing and
                opportunities through your date,
                time and place of birth.
              </p>

              <div className="mt-8 space-y-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="font-semibold">
                    Personalized Birth Chart
                  </p>

                  <p className="mt-1 text-sm text-white/60">
                    Accurate guidance for every
                    important life decision.
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="font-semibold">
                    Live Consultation
                  </p>

                  <p className="mt-1 text-sm text-white/60">
                    Chat or audio consultation with
                    verified astrologers.
                  </p>
                </div>
              </div>

              <Link
                href="/kundli"
                prefetch
                className="mt-8 inline-flex items-center font-semibold text-[#D4AF37]"
              >
                Explore your Kundli →
              </Link>
            </div>
          </div>

          <div className="absolute -bottom-6 -left-3 hidden rounded-2xl bg-white px-5 py-4 shadow-xl ring-1 ring-gray-100 sm:block">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Live Support
            </p>

            <p className="mt-1 font-bold text-[#0B1026]">
              Astrologers Available Online
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}