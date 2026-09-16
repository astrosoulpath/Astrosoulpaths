import type { Metadata } from "next";

import ServiceDetailPage from "@/features/home/ServiceDetailPage";

export const metadata: Metadata = {
  title: "Professional Kundli Reports | Astro Soul Path",
  description:
    "Explore professional Vedic Kundli reports with birth charts, planetary positions and Dasha analysis through verified astrologers.",
  alternates: {
    canonical: "/services/kundli-reports",
  },
};

export default function KundliReportsPage() {
  return (
    <ServiceDetailPage
      badge="Professional Kundli Reports"
      title="Understand Your Vedic Birth Chart"
      description="Connect with verified astrologers for professional Vedic Kundli interpretation based on accurate birth date, time and location."
      features={[
        "Birth Chart (D1)",
        "Navamsa Chart (D9)",
        "Planetary position analysis",
        "Houses and Nakshatra details",
        "Basic Dasha analysis",
        "Professional astrologer guidance",
      ]}
      primaryButtonText="Talk to an Astrologer"
      primaryButtonHref="/astrologers"
    />
  );
}
