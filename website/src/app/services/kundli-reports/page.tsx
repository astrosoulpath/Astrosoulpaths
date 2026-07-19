import type { Metadata } from "next";
import ServiceDetailPage from "@/features/home/ServiceDetailPage";

export const metadata: Metadata = {
  title: "Accurate Kundli Reports | Astro Soul Path",
  description:
    "Generate detailed Janam Kundli reports with planetary positions, dosha analysis, dasha reports and personalized Vedic astrology predictions.",
};

export default function KundliReportsPage() {
  return (
    <ServiceDetailPage
      badge="Accurate Kundli Reports"
      title="Generate Detailed Janam Kundli Reports"
      description="Generate accurate Janam Kundli reports using your birth details. Analyze planetary positions, houses, yogas, doshas and receive personalized recommendations with future predictions."
      features={[
        "Janam Kundli generation",
        "Planetary position analysis",
        "Dasha & Mahadasha reports",
        "Manglik & Dosha detection",
        "Career and marriage predictions",
        "Downloadable Kundli report",
      ]}
      primaryButtonText="Generate Kundli"
      primaryButtonHref="/kundli"
    />
  );
}