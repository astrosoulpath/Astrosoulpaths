import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function HeroSection() {
  return (
    <section className="bg-[#FAF7F0]">
      <div className="mx-auto grid min-h-[720px] max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
        <div>
          <span className="rounded-full bg-[#D4AF37]/20 px-4 py-2 text-sm font-semibold text-[#0B1026]">
            Welcome to AstroSoulPath
          </span>

          <h1 className="mt-6 text-5xl font-bold leading-tight text-[#0B1026] md:text-7xl">
            Discover Your Future With Trusted{" "}
            <span className="text-[#D4AF37]">Vedic Astrologers</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600">
            Personalized horoscope, Kundli, remedies, chat consultation, audio
            calls, and spiritual guidance powered by Vedic astrology.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/astrologers">
              <Button>Talk to Astrologer</Button>
            </Link>

            <Link href="/kundli">
              <Button variant="outline">Free Kundli</Button>
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-8 shadow-xl">
          <div className="rounded-[1.5rem] bg-[#0B1026] p-8 text-white">
            <p className="text-sm text-[#D4AF37]">Today&apos;s Guidance</p>
            <h2 className="mt-4 text-3xl font-bold">
              Your path becomes clearer when your birth chart speaks.
            </h2>
            <p className="mt-4 text-gray-300">
              Get personalized Vedic insights based on your date, time, and
              place of birth.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}