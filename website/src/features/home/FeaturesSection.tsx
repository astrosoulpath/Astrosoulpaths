import Link from "next/link";
import {
  ArrowUpRight,
  Languages,
  LockKeyhole,
  MessageCircleMore,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const features = [
  {
    title: "Personalized Vedic Guidance",
    description:
      "Receive astrology guidance based on your birth details, planetary positions and individual life goals.",
    href: "/services/vedic-guidance",
    icon: Sparkles,
    tag: "Personalized",
  },
  {
    title: "Verified Astrologers",
    description:
      "Connect with approved and verified astrologers across different areas of expertise.",
    href: "/astrologers",
    icon: ShieldCheck,
    tag: "Trusted",
  },
  {
    title: "Accurate Kundli Reports",
    description:
      "Generate detailed Janam Kundli reports with planetary positions, dashas, yogas and doshas.",
    href: "/services/kundli-reports",
    icon: ScrollText,
    tag: "Detailed",
  },
  {
    title: "100% Secure Payments",
    description:
      "Recharge your wallet and pay for consultations through a safe and transparent payment flow.",
    href: "/services/secure-payments",
    icon: LockKeyhole,
    tag: "Protected",
  },
  {
    title: "Instant Consultation",
    description:
      "Find available astrologers and start a chat or audio consultation through a simple booking flow.",
    href: "/astrologers",
    icon: MessageCircleMore,
    tag: "Live",
  },
  {
    title: "Multiple Languages",
    description:
      "Choose astrologers who communicate in Hindi, English and other supported languages.",
    href: "/services/multiple-languages",
    icon: Languages,
    tag: "Accessible",
  },
];

export function FeaturesSection() {
  return (
    <section className="relative overflow-hidden bg-[#FBF8F1] px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
      <div
        aria-hidden="true"
        className="absolute right-[-12rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-[#D4AF37]/8 blur-[110px]"
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2">
            <Sparkles className="h-3.5 w-3.5 text-[#AD8314]" />

            <span className="text-xs font-black uppercase tracking-[0.22em] text-[#A47B12]">
              Why Astro Soul Path
            </span>
          </div>

          <h2 className="mt-5 text-3xl font-black leading-[1.08] tracking-[-0.045em] text-[#08142E] sm:text-4xl lg:text-5xl">
            Everything you need for{" "}
            <span className="bg-gradient-to-r from-[#B88B16] to-[#D0A52D] bg-clip-text text-transparent">
              trusted astrology guidance.
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base font-medium leading-8 text-[#667085]">
            Professional astrology services, trusted consultations and
            personalized reports brought together in one seamless platform.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <Link
                key={feature.title}
                href={feature.href}
                aria-label={`Learn more about ${feature.title}`}
                className="group relative flex min-h-[292px] flex-col overflow-hidden rounded-[1.65rem] border border-[#E8E1D3] bg-white p-7 shadow-[0_10px_35px_rgba(12,25,52,.055)] transition duration-300 hover:-translate-y-1.5 hover:border-[#D4AF37]/60 hover:shadow-[0_24px_60px_rgba(12,25,52,.11)] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
              >
                <div className="absolute right-[-5rem] top-[-5rem] h-40 w-40 rounded-full bg-[#D4AF37]/0 blur-2xl transition duration-500 group-hover:bg-[#D4AF37]/10" />

                <div className="relative flex items-start justify-between gap-4">
                  <div className="flex h-13 w-13 h-[52px] w-[52px] items-center justify-center rounded-2xl border border-[#EADFBF] bg-gradient-to-br from-[#FFF9E8] to-[#F6EDCF] text-[#A57A0E] shadow-sm transition duration-300 group-hover:scale-105 group-hover:border-[#D4AF37]">
                    <Icon className="h-5 w-5" />
                  </div>

                  <span className="rounded-full bg-[#F7F4ED] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-[#7E7461]">
                    {feature.tag}
                  </span>
                </div>

                <h3 className="relative mt-7 text-xl font-black tracking-[-0.02em] text-[#0B1739] sm:text-2xl">
                  {feature.title}
                </h3>

                <p className="relative mt-3 flex-1 text-sm font-medium leading-7 text-[#6A7282] sm:text-[15px]">
                  {feature.description}
                </p>

                <div className="relative mt-6 flex items-center justify-between border-t border-[#EFEAE0] pt-5">
                  <span className="text-sm font-black text-[#9D7610]">
                    Explore
                  </span>

                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8F3E6] text-[#0B1739] transition duration-300 group-hover:bg-[#0B1739] group-hover:text-white">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
