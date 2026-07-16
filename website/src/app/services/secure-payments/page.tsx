import ServiceDetailPage from "@/features/home/ServiceDetailPage";

export default function SecurePaymentsPage() {
  return (
    <ServiceDetailPage
      badge="100% Secure Payments"
      title="Safe, Secure & Transparent Payments"
      description="Every payment on Astro Soul Path is processed through trusted payment gateways with secure encryption. Wallet transactions, consultation payments and refunds are protected to ensure a safe experience for every customer."
      features={[
        "256-bit encrypted payment processing",
        "Trusted payment gateway integration",
        "Instant wallet recharge",
        "Secure consultation payments",
        "Refund and transaction history",
        "Complete payment transparency",
      ]}
      primaryButtonText="Recharge Wallet"
      primaryButtonHref="/wallet"
    />
  );
}