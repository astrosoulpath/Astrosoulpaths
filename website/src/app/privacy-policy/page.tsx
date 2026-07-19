import type { Metadata } from "next";
import InfoPage from "@/features/legal/InfoPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Astro Soul Path",
  description:
    "Read how Astro Soul Path collects, uses, stores and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <InfoPage
      badge="Legal"
      title="Privacy Policy"
      description="This Privacy Policy explains how Astro Soul Path collects, uses, stores and protects your information when you use our platform."
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Information We Collect
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            We may collect your name, email address, phone number, birth
            details, consultation history, wallet transactions and other
            information required to provide our astrology services.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            How We Use Your Information
          </h2>

          <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
            <li>Provide astrology consultations and Kundli reports.</li>
            <li>Process wallet payments and transactions.</li>
            <li>Improve platform performance and user experience.</li>
            <li>Respond to customer support requests.</li>
            <li>Maintain platform security and prevent fraud.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Data Security
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            We use appropriate technical and organizational measures to protect
            your information against unauthorized access, disclosure or misuse.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Third-Party Services
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            We may use trusted third-party services for authentication,
            payments, analytics and communication. These providers process data
            according to their own privacy policies.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Contact Us
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            If you have any questions regarding this Privacy Policy, please
            contact us at{" "}
            <a
              href="mailto:support@astrosoulpath.com"
              className="font-semibold text-[#B58D16] hover:underline"
            >
              support@astrosoulpath.com
            </a>
            .
          </p>
        </section>
      </div>
    </InfoPage>
  );
}