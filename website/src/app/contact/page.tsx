import type { Metadata } from "next";
import InfoPage from "@/features/legal/InfoPage";

export const metadata: Metadata = {
  title: "Contact Us | Astro Soul Path",
  description:
    "Get in touch with Astro Soul Path for support, consultation assistance and general enquiries.",
};

export default function ContactPage() {
  return (
    <InfoPage
      badge="Contact Us"
      title="We're Here to Help"
      description="Need assistance with your account, wallet, consultations or Kundli reports? Our support team is ready to help."
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Customer Support
          </h2>

          <p className="mt-3 text-slate-700">
            If you have any questions about your account, consultations,
            payments or technical issues, feel free to contact us.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Email
          </h2>

          <a
            href="mailto:support@astrosoulpath.com"
            className="mt-3 inline-block font-semibold text-[#B58D16] hover:underline"
          >
            support@astrosoulpath.com
          </a>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Support Hours
          </h2>

          <p className="mt-3 text-slate-700">
            Monday – Saturday
            <br />
            10:00 AM – 7:00 PM (IST)
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Response Time
          </h2>

          <p className="mt-3 text-slate-700">
            We usually respond to all support requests within 24–48 business
            hours.
          </p>
        </section>
      </div>
    </InfoPage>
  );
}