import type { Metadata } from "next";
import ServiceDetailPage from "@/features/home/ServiceDetailPage";

export const metadata: Metadata = {
  title: "Multiple Language Astrology Consultations | Astro Soul Path",
  description:
    "Connect with verified astrologers in Hindi, English and multiple regional languages for a comfortable and personalized consultation experience.",
};

export default function MultipleLanguagesPage() {
  return (
    <ServiceDetailPage
      badge="Multiple Languages"
      title="Consult Astrologers In Your Preferred Language"
      description="Choose astrologers who speak your preferred language for a comfortable and personalized consultation experience. The platform supports multiple Indian and international languages."
      features={[
        "Hindi consultations",
        "English consultations",
        "Regional Indian languages",
        "Language-based astrologer filters",
        "Easy communication during consultations",
        "Better user experience with native language support",
      ]}
      primaryButtonText="Browse Astrologers"
      primaryButtonHref="/astrologers"
    />
  );
}