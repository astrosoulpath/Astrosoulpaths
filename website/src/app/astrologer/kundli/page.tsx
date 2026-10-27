import type { Metadata } from "next";

import { KundliForm } from "@/features/kundli/KundliForm";

export const metadata: Metadata = {
  title: "Professional Kundli",
  description:
    "Professional Kundli workspace and authorized saved reports. New generation remains subject to existing activation, consent and subscription requirements.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AstrologerKundliPage() {
  return <KundliForm mode="professional" />;
}
