"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

const navItems = [
  { name: "Home", href: "/" },
  { name: "Astrologers", href: "/astrologers" },
  { name: "Kundli", href: "/kundli" },
  { name: "Horoscope", href: "/horoscope" },
  { name: "Remedies", href: "/remedies" },
  { name: "Blog", href: "/blog" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="shrink-0">
          <Logo />
        </div>

        {/* Desktop Navigation */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-6 lg:flex"
        >
          {navItems.map((item) => {
            const isActive = isActiveRoute(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-[#D4AF37]"
                    : "text-gray-700 hover:text-[#D4AF37]"
                }`}
              >
                {item.name}

                {isActive && (
                  <span className="absolute inset-x-0 -bottom-1 h-0.5 rounded-full bg-[#D4AF37]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <Link
            href="/login"
            className={`text-sm font-semibold transition-colors ${
              isActiveRoute("/login")
                ? "text-[#D4AF37]"
                : "text-[#0B1026] hover:text-[#D4AF37]"
            }`}
          >
            Login
          </Link>

          <Link href="/signup">
            <Button>Get Started</Button>
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <button
          type="button"
          aria-label={
            isMobileMenuOpen
              ? "Close navigation menu"
              : "Open navigation menu"
          }
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-[#0B1026] transition hover:border-[#D4AF37] hover:text-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 lg:hidden"
        >
          {isMobileMenuOpen ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
            >
              <path
                d="M6 6L18 18M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
            >
              <path
                d="M4 7H20M4 12H20M4 17H20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="border-t border-gray-200 bg-white px-4 pb-6 pt-4 shadow-lg lg:hidden"
        >
          <nav
            aria-label="Mobile navigation"
            className="mx-auto flex max-w-7xl flex-col gap-1"
          >
            {navItems.map((item) => {
              const isActive = isActiveRoute(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#D4AF37]/10 text-[#B58D16]"
                      : "text-gray-700 hover:bg-gray-50 hover:text-[#D4AF37]"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="mx-auto mt-5 flex max-w-7xl flex-col gap-3 border-t border-gray-200 pt-5">
            <Link
              href="/login"
              className="flex h-11 items-center justify-center rounded-xl border border-[#0B1026] text-sm font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
            >
              Login
            </Link>

            <Link
              href="/signup"
              className="flex h-11 items-center justify-center rounded-xl bg-[#D4AF37] px-5 text-sm font-semibold text-[#0B1026] transition hover:bg-[#C49F2F]"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}