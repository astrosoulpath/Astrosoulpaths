import ServiceDetailPage from "@/features/home/ServiceDetailPage";

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