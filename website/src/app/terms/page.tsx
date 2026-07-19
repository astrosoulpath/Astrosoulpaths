import type { Metadata } from "next";
import InfoPage from "@/features/legal/InfoPage";

export const metadata: Metadata = {
  title: "Terms & Conditions | Astro Soul Path",
  description:
    "Read the terms and conditions governing the use of Astro Soul Path and its astrology consultation services.",
};

export default function TermsPage() {
  return (
    <InfoPage
      badge="Legal"
      title="Terms & Conditions"
      description="Please read these Terms & Conditions carefully before using Astro Soul Path."
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Acceptance of Terms
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            By accessing or using Astro Soul Path, you agree to comply with
            these Terms & Conditions and all applicable laws.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            User Responsibilities
          </h2>

          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
            <li>Provide accurate registration information.</li>
            <li>Keep your account credentials secure.</li>
            <li>Do not misuse or interfere with the platform.</li>
            <li>Respect astrologers and other users.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Consultations
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            Astrology consultations are intended for guidance and personal
            insight only. They should not be considered a substitute for
            professional medical, legal, financial or psychological advice.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Payments
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            All payments are processed securely. Users are responsible for
            reviewing consultation charges before confirming any booking or
            wallet recharge.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Account Suspension
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            We reserve the right to suspend or terminate accounts involved in
            fraudulent activities, misuse of the platform or violations of
            these Terms & Conditions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Changes to Terms
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            Astro Soul Path may update these Terms & Conditions from time to
            time. Continued use of the platform after updates constitutes
            acceptance of the revised terms.
          </p>
        </section>
      </div>
    </InfoPage>
  );
}