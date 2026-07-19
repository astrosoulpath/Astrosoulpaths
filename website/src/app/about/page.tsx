import type { Metadata } from "next";
import InfoPage from "@/features/legal/InfoPage";

export const metadata: Metadata = {
  title: "About Us | Astro Soul Path",
  description:
    "Learn about Astro Soul Path and our mission to provide trusted astrology consultations and spiritual guidance.",
};

export default function AboutPage() {
  return (
    <InfoPage
      badge="About Us"
      title="Trusted Astrology Guidance for Modern Life"
      description="Astro Soul Path connects users with verified astrologers for personalized consultations, Kundli reports, horoscope guidance and spiritual services."
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Our Mission
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            Our mission is to make authentic Vedic astrology accessible to
            everyone through verified astrologers, secure technology and a
            seamless online consultation experience.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            What We Offer
          </h2>

          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
            <li>Live chat and audio consultations</li>
            <li>Verified astrologer profiles</li>
            <li>Janam Kundli generation</li>
            <li>Daily and yearly horoscope</li>
            <li>Career, marriage and finance guidance</li>
            <li>Secure wallet and payment system</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Why Choose Astro Soul Path?
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            We focus on trusted astrologers, transparent pricing, secure
            payments and a modern platform designed to make spiritual guidance
            simple and accessible.
          </p>
        </section>
      </div>
    </InfoPage>
  );
}