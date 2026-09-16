"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { clearAuthSession } from "@/services/authService";

type UserPortal = "customer" | "astrologer" | "admin";

type StoredUser = {
  role?: string;
  userRole?: string;
  type?: string;
  portal?: string;
  accountRole?: string;
  isAstrologer?: boolean;
  astrologerStatus?: string;
};

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

const AUTH_STORAGE_KEYS = [
  // Customer authentication
  "asp_access_token",
  "asp_refresh_token",
  "access_token",
  "refresh_token",
  "asp_user",
  "asp_auth_user",
  "user",

  // Astrologer authentication
  "asp_astrologer_access_token",
  "asp_astrologer_refresh_token",
  "asp_astrologer_user",

  // Admin authentication
  "asp_admin_access_token",
  "asp_admin_refresh_token",
  "asp_admin_user",

  // Shared temporary authentication data
  "asp_otp_context",
  "asp_post_login_redirect",
  "asp_signup_data",
  "admin_phone",
] as const;

function normalizePortal(value: unknown): UserPortal {
  const portal = String(value ?? "")
    .trim()
    .toLowerCase();

  if (portal === "admin") {
    return "admin";
  }

  if (portal === "astrologer") {
    return "astrologer";
  }

  return "customer";
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    localStorage.getItem("asp_admin_access_token") ??
    localStorage.getItem("asp_astrologer_access_token") ??
    localStorage.getItem("asp_access_token") ??
    localStorage.getItem("access_token")
  );
}

function getStoredUser(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    localStorage.getItem("asp_admin_user") ??
    localStorage.getItem("asp_astrologer_user") ??
    localStorage.getItem("asp_auth_user") ??
    localStorage.getItem("asp_user") ??
    localStorage.getItem("user")
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPortal, setUserPortal] = useState<UserPortal>("customer");

  const [isAstrologerAccount, setIsAstrologerAccount] = useState(false);

  const [astrologerStatus, setAstrologerStatus] = useState<string | null>(null);

  const [authChecked, setAuthChecked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const updateAuthState = () => {
      const isAdminRoute =
        pathname === "/admin" || pathname.startsWith("/admin/");

      const isAstrologerRoute =
        pathname === "/astrologer" || pathname.startsWith("/astrologer/");

      const token = isAdminRoute
        ? (localStorage.getItem("asp_admin_access_token") ??
          localStorage.getItem("asp_access_token") ??
          localStorage.getItem("access_token"))
        : isAstrologerRoute
          ? (localStorage.getItem("asp_astrologer_access_token") ??
            localStorage.getItem("asp_access_token") ??
            localStorage.getItem("access_token"))
          : (localStorage.getItem("asp_access_token") ??
            localStorage.getItem("access_token") ??
            localStorage.getItem("asp_astrologer_access_token") ??
            localStorage.getItem("asp_admin_access_token"));

      const storedUser = isAdminRoute
        ? (localStorage.getItem("asp_admin_user") ??
          localStorage.getItem("asp_auth_user") ??
          localStorage.getItem("asp_user") ??
          localStorage.getItem("user"))
        : isAstrologerRoute
          ? (localStorage.getItem("asp_astrologer_user") ??
            localStorage.getItem("asp_auth_user") ??
            localStorage.getItem("asp_user") ??
            localStorage.getItem("user"))
          : (localStorage.getItem("asp_user") ??
            localStorage.getItem("asp_auth_user") ??
            localStorage.getItem("user") ??
            localStorage.getItem("asp_astrologer_user") ??
            localStorage.getItem("asp_admin_user"));

      setIsLoggedIn(Boolean(token));

      if (!token || !storedUser) {
        setUserRole(null);
        setUserPortal("customer");
        setIsAstrologerAccount(false);
        setAstrologerStatus(null);
        setAuthChecked(true);
        return;
      }

      try {
        const user = JSON.parse(storedUser) as StoredUser;

        const role = String(user.role ?? user.userRole ?? user.type ?? "")
          .trim()
          .toUpperCase();

        const accountRole = String(user.accountRole ?? "")
          .trim()
          .toUpperCase();

        const status = String(user.astrologerStatus ?? "")
          .trim()
          .toUpperCase();

        let portal = normalizePortal(user.portal);

        if (
          portal === "customer" &&
          (role === "ADMIN" || accountRole === "ADMIN")
        ) {
          portal = "admin";
        }

        if (
          portal === "customer" &&
          (Boolean(user.isAstrologer) ||
            role === "ASTROLOGER" ||
            role === "ASTROLOGER_USER" ||
            accountRole === "ASTROLOGER")
        ) {
          portal = "astrologer";
        }

        setUserRole(role || null);
        setUserPortal(portal);
        setAstrologerStatus(status || null);

        setIsAstrologerAccount(
          portal === "astrologer" ||
            Boolean(user.isAstrologer) ||
            accountRole === "ASTROLOGER" ||
            role === "ASTROLOGER" ||
            role === "ASTROLOGER_USER",
        );
      } catch {
        setIsLoggedIn(false);
        setUserRole(null);
        setUserPortal("customer");
        setIsAstrologerAccount(false);
        setAstrologerStatus(null);
      }

      setAuthChecked(true);
    };

    updateAuthState();

    window.addEventListener("storage", updateAuthState);

    window.addEventListener("asp-auth-changed", updateAuthState);

    return () => {
      window.removeEventListener("storage", updateAuthState);

      window.removeEventListener("asp-auth-changed", updateAuthState);
    };
  }, [pathname]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const hasCustomerSession =
    typeof window !== "undefined" &&
    Boolean(
      localStorage.getItem("asp_access_token") ??
      localStorage.getItem("access_token"),
    );

  const effectivePortal: UserPortal =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/")
      ? "customer"
      : pathname === "/admin" || pathname.startsWith("/admin/")
        ? "admin"
        : pathname === "/astrologer" || pathname.startsWith("/astrologer/")
          ? "astrologer"
          : hasCustomerSession
            ? "customer"
            : userPortal;

  const getDashboardUrl = () => {
    if (effectivePortal === "admin") {
      return "/admin";
    }

    if (effectivePortal === "astrologer") {
      return "/astrologer/dashboard";
    }

    return "/dashboard";
  };

  const getDashboardLabel = () => {
    if (effectivePortal === "admin") {
      return "Admin Panel";
    }

    if (effectivePortal === "astrologer") {
      return "Astrologer Panel";
    }

    return "Dashboard";
  };

  const handleLogout = () => {
    clearAuthSession();

    AUTH_STORAGE_KEYS.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    sessionStorage.clear();

    setIsLoggedIn(false);
    setUserRole(null);
    setUserPortal("customer");
    setIsAstrologerAccount(false);
    setAstrologerStatus(null);
    setMobileMenuOpen(false);
    setAuthChecked(true);

    window.dispatchEvent(new Event("asp-auth-changed"));

    router.replace("/");
    router.refresh();
  };

  const isActiveRoute = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isAstrologerPending =
    isAstrologerAccount &&
    ["PENDING", "PENDING_APPROVAL", "UNDER_REVIEW"].includes(
      astrologerStatus ?? "",
    );

  const showJoinAsAstrologer =
    userPortal === "customer" && !isAstrologerAccount && !isAstrologerPending;

  const showPublicNavigation =
    effectivePortal !== "astrologer" && effectivePortal !== "admin";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E8E3D8]/80 bg-white/85 shadow-[0_8px_30px_rgba(10,22,52,.045)] backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1400px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-8 xl:gap-5 2xl:gap-8">
        <Logo />

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-[#0B1739] shadow-sm transition hover:border-[#D4AF37] xl:hidden"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          onClick={() => setMobileMenuOpen((current) => !current)}
        >
          {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        <nav className="hidden flex-1 items-center justify-center gap-5 xl:flex 2xl:gap-7">
          {showPublicNavigation
            ? navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition ${
                    isActiveRoute(item.href)
                      ? "font-bold text-[#A77C10]"
                      : "text-[#4F596B] hover:text-[#A77C10]"
                  }`}
                >
                  {item.name}
                </Link>
              ))
            : null}
        </nav>

        <div className="hidden items-center gap-3 whitespace-nowrap xl:flex 2xl:gap-5">
          {authChecked && isLoggedIn ? (
            <>
              {!isAstrologerPending && (
                <Link
                  href={getDashboardUrl()}
                  className="text-sm font-bold text-[#17213D] transition hover:text-[#A77C10]"
                >
                  {getDashboardLabel()}
                </Link>
              )}

              {showJoinAsAstrologer && (
                <Link
                  href="/astrologer/register"
                  className="text-sm font-bold text-[#17213D] transition hover:text-[#A77C10]"
                >
                  Join as Astrologer
                </Link>
              )}

              {isAstrologerPending && (
                <Link
                  href="/astrologer/pending"
                  className="rounded-xl bg-amber-50 px-4 py-2 font-semibold text-amber-700 transition hover:bg-amber-100"
                >
                  Application Pending
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-red-600 px-5 py-2 text-red-600 transition hover:bg-red-600 hover:text-white"
              >
                Logout
              </button>
            </>
          ) : authChecked ? (
            <>
              <Link
                href="/login"
                className="text-sm font-bold text-[#17213D] transition hover:text-[#A77C10]"
              >
                Customer Login
              </Link>

              <Link
                href="/astrologer/login"
                className="text-sm font-bold text-[#17213D] transition hover:text-[#A77C10]"
              >
                Astrologer Login
              </Link>

              <Link
                href="/astrologer/register"
                className="text-sm font-bold text-[#17213D] transition hover:text-[#A77C10]"
              >
                Join as Astrologer
              </Link>

              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="absolute left-0 top-[76px] w-full space-y-2 border-t border-white/10 bg-[#071329]/[0.98] p-5 shadow-[0_28px_60px_rgba(0,0,0,.25)] backdrop-blur-xl xl:hidden">
          {showPublicNavigation
            ? navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="group block rounded-xl px-4 py-3 font-medium text-white transition-all duration-300 hover:translate-x-3 hover:border-l-4 hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] hover:shadow-lg"
                >
                  <span className="transition-all duration-300 group-hover:tracking-wider">
                    {item.name}
                  </span>
                </Link>
              ))
            : null}

          <hr className="border-gray-700" />

          {authChecked && isLoggedIn ? (
            <>
              {!isAstrologerPending && (
                <Link
                  href={getDashboardUrl()}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 font-semibold text-white transition hover:bg-white/10 hover:text-[#D4AF37]"
                >
                  {getDashboardLabel()}
                </Link>
              )}

              {showJoinAsAstrologer && (
                <Link
                  href="/astrologer/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl px-4 py-3 font-semibold text-white transition hover:bg-white/10 hover:text-[#D4AF37]"
                >
                  Join as Astrologer
                </Link>
              )}

              {isAstrologerPending && (
                <Link
                  href="/astrologer/pending"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block rounded-xl bg-amber-500/10 px-4 py-3 font-semibold text-amber-300 transition hover:bg-amber-500/20"
                >
                  Application Pending
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="block w-full rounded-xl px-4 py-3 text-left font-semibold text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
              >
                Logout
              </button>
            </>
          ) : authChecked ? (
            <>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-xl px-4 py-3 font-semibold text-white transition hover:bg-white/10 hover:text-[#D4AF37]"
              >
                Customer Login
              </Link>

              <Link
                href="/astrologer/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-xl px-4 py-3 font-semibold text-white transition hover:bg-white/10 hover:text-[#D4AF37]"
              >
                Astrologer Login
              </Link>

              <Link
                href="/astrologer/register"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-xl px-4 py-3 font-semibold text-white transition hover:bg-white/10 hover:text-[#D4AF37]"
              >
                Join as Astrologer
              </Link>

              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-2"
              >
                <Button>Get Started</Button>
              </Link>
            </>
          ) : null}
        </div>
      )}
    </header>
  );
}

