import ConsultationKundliWorkspace from "@/features/kundli/ConsultationKundliWorkspace";
export const metadata = { title: "Consultation Kundli", robots: { index: false, follow: false } };
export default async function ConsultationKundliPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ConsultationKundliWorkspace id={id} />;
}
