import type { Metadata } from "next";

import { KundliForm } from "@/features/kundli/KundliForm";

export const metadata: Metadata = {
  title: "Professional Kundli",
  description:
    "Generate and save detailed Vedic Kundli reports for astrology customers.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AstrologerKundliPage() {
  return <KundliForm mode="professional" />;
}
