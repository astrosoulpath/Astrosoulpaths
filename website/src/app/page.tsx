import { HeroSection } from "@/features/home/HeroSection";
import { StatsSection } from "@/features/home/StatsSection";
import { WhyChooseSection } from "@/features/home/WhyChooseSection";
import { FeaturedAstrologersSection } from "@/features/home/FeaturedAstrologersSection";
import { ServicesSection } from "@/features/home/ServicesSection";
import { HoroscopeSubscriptionSection } from "@/features/home/HoroscopeSubscriptionSection";
import { KundliPromoSection } from "@/features/home/KundliPromoSection";


export default function HomePage() {
  return (
    <>
      <HeroSection />
      <StatsSection />
      <WhyChooseSection />
      <FeaturedAstrologersSection />
      <ServicesSection />
      <HoroscopeSubscriptionSection />
      <KundliPromoSection />
    </>
  );
}