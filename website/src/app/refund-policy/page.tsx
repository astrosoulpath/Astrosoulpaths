import type { Metadata } from "next";
import InfoPage from "@/features/legal/InfoPage";

export const metadata: Metadata = {
  title: "Refund Policy | Astro Soul Path",
  description:
    "Read the Astro Soul Path refund policy for consultations, wallet recharges and payment transactions.",
};

export default function RefundPolicyPage() {
  return (
    <InfoPage
      badge="Legal"
      title="Refund Policy"
      description="This Refund Policy explains how refund requests are handled for consultations, wallet transactions and other services offered by Astro Soul Path."
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Wallet Recharges
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            Wallet recharges are generally non-refundable once the amount has
            been successfully credited to your Astro Soul Path wallet, except
            where required by applicable law or in cases of verified payment
            errors.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Failed Transactions
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            If a payment is deducted but the wallet is not credited or a
            consultation is not confirmed because of a technical issue, our
            team will verify the transaction and process a refund or wallet
            adjustment where appropriate.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Consultation Refunds
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            Refund requests may be considered if a consultation cannot be
            completed due to verified technical problems or platform-related
            issues. Completed consultations are generally not eligible for a
            refund.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Kundli Reports
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            Digital Kundli reports and other downloadable products are
            generally non-refundable once they have been successfully generated
            and delivered.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Refund Processing Time
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            Approved refunds are typically processed within 5–10 business days,
            depending on your payment provider or bank.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#0B1026]">
            Need Help?
          </h2>

          <p className="mt-3 leading-7 text-slate-700">
            If you have questions regarding refunds or payments, please contact
            us at{" "}
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