import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck, Sparkles } from "lucide-react";

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Astrologers", href: "/astrologers" },
  { label: "Kundli", href: "/kundli" },
  { label: "Horoscope", href: "/horoscope" },
  { label: "Blog", href: "/blog" },
];

const serviceLinks = [
  { label: "Vedic Guidance", href: "/services/vedic-guidance" },
  { label: "Kundli Reports", href: "/services/kundli-reports" },
  { label: "Secure Payments", href: "/services/secure-payments" },
  { label: "Multiple Languages", href: "/services/multiple-languages" },
];

const supportLinks = [
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Refund Policy", href: "/refund-policy" },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-[#061126] text-white">
      <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-[#D4AF37]/8 blur-[110px]" />
      <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-indigo-400/8 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="mb-14 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <div className="flex items-center gap-2 text-[#E1C14B]">
              <Sparkles className="h-4 w-4" />

              <span className="text-xs font-black uppercase tracking-[0.2em]">
                Astro Soul Path
              </span>
            </div>

            <h2 className="mt-3 max-w-2xl text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              Ready for personalized Vedic guidance?
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
              Connect with verified astrologers or explore your professional
              Kundli.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Link
              href="/astrologers"
              className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D7B23C] to-[#C99A1E] px-6 py-3.5 text-sm font-black text-[#071329]"
            >
              Talk to an Astrologer
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>

            <Link
              href="/kundli"
              className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-3.5 text-sm font-black text-white transition hover:border-[#D4AF37]/50 hover:text-[#E1C14B]"
            >
              Explore Kundli
            </Link>
          </div>
        </div>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <Link
              href="/"
              className="text-2xl font-black tracking-[-0.035em] text-white"
            >
              Astro
              <span className="text-[#D4AF37]">SoulPath</span>
            </Link>

            <p className="mt-4 max-w-md text-sm font-medium leading-7 text-white/55">
              A modern Vedic astrology platform for verified consultations,
              detailed Kundli reports and personalized spiritual guidance.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-4 py-2 text-xs font-bold text-emerald-200">
              <ShieldCheck className="h-4 w-4" />
              Secure consultation platform
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#E1C14B]">
              Quick Links
            </h3>

            <nav className="mt-5 space-y-3" aria-label="Footer quick links">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm font-medium text-white/55 transition hover:translate-x-1 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#E1C14B]">
              Services
            </h3>

            <nav className="mt-5 space-y-3" aria-label="Footer service links">
              {serviceLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm font-medium text-white/55 transition hover:translate-x-1 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-[#E1C14B]">
              Support
            </h3>

            <nav className="mt-5 space-y-3" aria-label="Footer support links">
              {supportLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm font-medium text-white/55 transition hover:translate-x-1 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <a
              href="mailto:support@astrosoulpath.com"
              className="mt-6 flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-[#E1C14B]"
            >
              <Mail className="h-4 w-4 shrink-0" />
              <span className="break-all">support@astrosoulpath.com</span>
            </a>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-7 text-xs font-medium text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>© {currentYear} Astro Soul Path. All rights reserved.</p>

          <p>
            Astrology guidance is for personal insight and is not a substitute
            for professional advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
