import Link from "next/link";

const quickLinks = [
  { label: "Home", href: "/" },
  { label: "Astrologers", href: "/astrologers" },
  { label: "Kundli", href: "/kundli" },
  { label: "Horoscope", href: "/horoscope" },
  { label: "Blog", href: "/blog" },
];

const supportLinks = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms" },
];

export default function Footer() {
  return (
    <footer className="bg-[#0B1026] text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <h2 className="text-2xl font-bold text-[#D4AF37]">
              AstroSoulPath
            </h2>

            <p className="mt-4 text-gray-300">
              India's modern Vedic astrology platform for chat, calls,
              horoscope, Kundli and spiritual guidance.
            </p>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">Quick Links</h3>

            <div className="space-y-3">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-gray-300 hover:text-[#D4AF37]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">Support</h3>

            <div className="space-y-3">
              {supportLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block text-gray-300 hover:text-[#D4AF37]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-semibold">Contact</h3>

            <p className="text-gray-300">
              support@astrosoulpath.com
            </p>

            <p className="mt-2 text-gray-300">
              +91 XXXXX XXXXX
            </p>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-sm text-gray-400">
          © 2026 AstroSoulPath. All rights reserved.
        </div>
      </div>
    </footer>
  );
}