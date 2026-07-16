import type { Metadata } from "next";

import { FeaturedAstrologersSection } from "@/features/home/FeaturedAstrologersSection";
import { FeaturesSection } from "@/features/home/FeaturesSection";
import { HeroSection } from "@/features/home/HeroSection";
import { HoroscopeSubscriptionSection } from "@/features/home/HoroscopeSubscriptionSection";
import { KundliPromoSection } from "@/features/home/KundliPromoSection";
import { ServicesSection } from "@/features/home/ServicesSection";
import { StatsSection } from "@/features/home/StatsSection";

export const metadata: Metadata = {
  title:
    "Astro Soul Path | Best Online Astrology Consultation",

  description:
    "Connect with verified Vedic astrologers for Kundli, Horoscope, Tarot, Numerology, Match Making, Dosha Analysis and live chat or audio consultation.",

  keywords: [
    "Astrology",
    "Online Astrologer",
    "Kundli",
    "Horoscope",
    "Vedic Astrology",
    "Tarot",
    "Numerology",
    "Palm Reading",
    "Marriage Matching",
    "Astro Soul Path",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title:
      "Astro Soul Path | Best Online Astrology Consultation",

    description:
      "Talk with verified astrologers online. Get accurate Kundli, Horoscope, Match Making and Vedic Astrology guidance.",

    type: "website",

    siteName: "Astro Soul Path",
  },

  twitter: {
    card: "summary_large_image",

    title: "Astro Soul Path",

    description:
      "Professional astrology consultation platform.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Astro Soul Path",
            url: "https://astrosoulpath.com",
            logo: "https://astrosoulpath.com/logo.png",
            sameAs: [],
          }),
        }}
      />

      <HeroSection />

      <StatsSection />

      <FeaturesSection />

      <FeaturedAstrologersSection />

      <ServicesSection />

      <KundliPromoSection />

      <HoroscopeSubscriptionSection />
    </>
  );
}