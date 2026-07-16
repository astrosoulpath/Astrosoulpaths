import ServiceDetailPage from "@/features/home/ServiceDetailPage";

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