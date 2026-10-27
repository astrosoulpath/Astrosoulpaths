import { KundliForm } from "@/features/kundli/KundliForm";

export const metadata = {
  title: "Vedic Kundli & Your Reports | Astro Soul Path",
  description: "Prepare accurate birth details and access authorized finalized Kundli reports. Existing customer ownership and professional subscription rules are preserved.",
  alternates: { canonical: "/kundli" },
};

export default function Page() {
  return <KundliForm />;
}

