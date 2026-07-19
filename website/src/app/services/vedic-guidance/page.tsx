import type { Metadata } from "next";
import ServiceDetailPage from "@/features/home/ServiceDetailPage";

export const metadata: Metadata = {
  title: "Personalized Vedic Guidance | Astro Soul Path",
  description:
    "Receive personalized Vedic astrology guidance based on your birth details, planetary positions and life goals.",
};

export default function VedicGuidancePage() {
  return (
    <ServiceDetailPage
      badge="Personalized Vedic Guidance"
      title="Astrology Guidance Based on Your Birth Details"
      description="Receive personalized Vedic astrology guidance using your date of birth, exact birth time and birthplace. The final recommendations can be connected with your Kundli, planetary positions, dashas and consultation history."
      features={[
        "Personalized guidance based on birth details",
        "Vedic astrology interpretation",
        "Planetary position analysis",
        "Dasha and life-period guidance",
        "Career, relationship and financial insights",
        "Recommended remedies and practical actions",
      ]}
      primaryButtonText="Talk to an Astrologer"
      primaryButtonHref="/astrologers"
    />
  );
}