import { AstrologerRecruitmentSection } from '@/features/home/AstrologerRecruitmentSection';
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicHomepageAllowed } from "@/features/home/public-launch";
import { HomeCompletionSections, HomeGuidanceSections } from "@/features/home/HomeCompletionSections";

export const dynamic = 'force-dynamic';

import { FeaturedAstrologersSection } from "@/features/home/FeaturedAstrologersSection";
import { CinematicHome } from "@/features/home/CinematicHome";
import { StoryCarousel } from "@/features/home/StoryCarousel";
import { HomeEditorialFeeds } from "@/features/home/HomeEditorialFeeds";
import { HeroSection } from "@/features/home/HeroSection";
import { HoroscopeSubscriptionSection } from "@/features/home/HoroscopeSubscriptionSection";
import { KundliPromoSection } from "@/features/home/KundliPromoSection";
import { ServicesSection } from "@/features/home/ServicesSection";
import { StatsSection } from "@/features/home/StatsSection";

export const metadata: Metadata = {
  title:
    "Astro Soul Path | Online Astrology Consultation",

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
      "Astro Soul Path | Online Astrology Consultation",

    description:
      "Talk with verified astrologers online. Explore authorized Kundli reports, horoscope readings and Vedic Astrology guidance.",

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
    index: false,
    follow: false,
  },
};

export default function HomePage() {
  if (!publicHomepageAllowed()) notFound();
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

      <CinematicHome>
      <HeroSection />
      <StoryCarousel />

      <StatsSection />



      <FeaturedAstrologersSection />
      <AstrologerRecruitmentSection />

      <ServicesSection />

      <KundliPromoSection />

      <HoroscopeSubscriptionSection />
      <HomeGuidanceSections />
      <HomeEditorialFeeds />
      <HomeCompletionSections />
      </CinematicHome>
    </>
  );
}
