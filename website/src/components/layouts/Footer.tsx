import Link from "next/link";

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Astrologers", href: "/astrologers" },
  { label: "Kundli", href: "/kundli" },
  { label: "Horoscope", href: "/horoscope" },
  { label: "Blog", href: "/blog" },
];

const serviceLinks = [
  {
    label: "Vedic Guidance",
    href: "/services/vedic-guidance",
  },
  {
    label: "Kundli Reports",
    href: "/services/kundli-reports",
  },
  {
    label: "Secure Payments",
    href: "/services/secure-payments",
  },
  {
    label: "Multiple Languages",
    href: "/services/multiple-languages",
  },
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
    <footer className="bg-[#0B1026] text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-2">
            <Link
              href="/"
              className="inline-block text-2xl font-bold tracking-tight text-[#D4AF37]"
            >
              Astro Soul Path
            </Link>

            <p className="mt-4 max-w-md text-sm leading-7 text-gray-300">
              A modern Vedic astrology platform for verified astrologer
              consultations, Kundli reports, horoscope guidance and spiritual
              services.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/astrologers"
                className="rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-[#0B1026] transition hover:bg-[#C49F2F]"
              >
                Talk to an Astrologer
              </Link>

              <Link
                href="/kundli"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-[#D4AF37] hover:text-[#D4AF37]"
              >
                Generate Kundli
              </Link>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Quick Links
            </h3>

            <nav className="mt-5 space-y-3" aria-label="Footer quick links">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm text-gray-300 transition hover:text-[#D4AF37]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Services
            </h3>

            <nav className="mt-5 space-y-3" aria-label="Footer service links">
              {serviceLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm text-gray-300 transition hover:text-[#D4AF37]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Support
            </h3>

            <nav className="mt-5 space-y-3" aria-label="Footer support links">
              {supportLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-sm text-gray-300 transition hover:text-[#D4AF37]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-7">
              <h4 className="text-sm font-semibold text-white">
                Contact
              </h4>

              <a
                href="mailto:support@astrosoulpath.com"
                className="mt-3 block break-all text-sm text-gray-300 transition hover:text-[#D4AF37]"
              >
                support@astrosoulpath.com
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {currentYear} Astro Soul Path. All rights reserved.
          </p>

          <p>
            Astrology guidance should be used for personal insight and not as a
            substitute for professional advice.
          </p>
        </div>
      </div>
    </footer>
  );
}