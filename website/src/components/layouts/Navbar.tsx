"use client";
import Link from "next/link";
import { SubscriptionNotificationBell } from '@/features/notifications/SubscriptionNotificationCenter';
import {verifyCustomerSession} from '@/features/auth/customer-session';
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown, UserRound } from "lucide-react";
import {
  beginPublicAuthAttempt,
  clearPublicPortal,
  destinationFor,
  sessionCandidate,
  verifyNavigationSession,
  type NavigationSession,
} from "@/features/auth/public-auth";
import s from "./navigation.module.css";
const links = [
  ["Home", "/"],
  ["Astrologers", "/astrologers"],
  ["Kundli", "/kundli"],
  ["Horoscope", "/horoscope"],
  ["Remedies", "/remedies"],
] as const;
const more = [
  ["Articles", "/blog"],
  ["About Us", "/about"],
  ["Contact Us", "/contact"],
  ["Our Services", "/services"],
] as const;
export default function Navbar() {
  const pathname = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState<"more" | "account" | "mobile" | null>(null),
    [session, setSession] = useState<NavigationSession | null>(null),
    [checked, setChecked] = useState(false),
    [notice, setNotice] = useState(""),
    [leaving, setLeaving] = useState(false),
    [verificationAttempt, setVerificationAttempt] = useState(0);
  const root = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null),
    logoutLock = useRef(false);
  useEffect(() => {
    let active = true,
      abort: AbortController | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let pendingSnapshot: string | undefined;
    let verifiedSnapshot: string | undefined;
    const update = () => {
      const candidate = sessionCandidate(pathname);
      // Repeated focus/storage events must not continually abort the same
      // request and reset its deadline, leaving Checking account indefinitely.
      if (pendingSnapshot && pendingSnapshot === candidate?.snapshot) return;
      abort?.abort();
      clearTimeout(deadline);
      const controller = new AbortController();
      abort = controller;
      pendingSnapshot = candidate?.snapshot;
      if (!candidate || candidate.snapshot !== verifiedSnapshot) {
        setSession(null);
        setChecked(false);
      }
      setNotice("");
      if (!candidate) {
        setChecked(true);
        return;
      }
      deadline = setTimeout(() => {
        if (!active || controller.signal.aborted) return;
        controller.abort();
        pendingSnapshot = undefined;
        verifiedSnapshot = undefined;
        setSession(null);
        setChecked(true);
        setNotice("Account verification timed out. Check your connection and retry sign-in.");
      }, 28000);
      void (candidate.portal==='customer'?verifyCustomerSession(controller.signal):verifyNavigationSession(pathname, controller.signal))
        .then((value) => {
          if (active && !controller.signal.aborted) {
            setSession(value);
            verifiedSnapshot = value ? sessionCandidate(pathname)?.snapshot : undefined;
            if (!value)
              setNotice(
                "Your session needs verification. Please sign in again.",
              );
          }
        })
        .catch(() => {
          if (active && !controller.signal.aborted) {
            verifiedSnapshot = undefined;
            setSession(null);
            setNotice(
              "Account access could not be verified. Sign in or retry after checking your connection.",
            );
          }
        })
        .finally(() => {
          if (active && !controller.signal.aborted) {
            pendingSnapshot = undefined;
            clearTimeout(deadline);
            setChecked(true);
          }
        });
    };
    update();
    window.addEventListener("storage", update);
    window.addEventListener("asp-auth-changed", update);
    window.addEventListener("focus", update);
    return () => {
      active = false;
      clearTimeout(deadline);
      abort?.abort();
      window.removeEventListener("storage", update);
      window.removeEventListener("asp-auth-changed", update);
      window.removeEventListener("focus", update);
    };
  }, [pathname, verificationAttempt]);
  useEffect(() => {
    setOpen(null);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        trigger.current?.focus();
      }
    };
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    const first = root.current?.querySelector<HTMLElement>(
      "[data-navigation-panel] a",
    );
    first?.focus();
    return () => {
      document.removeEventListener("keydown", escape);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  function toggle(
    kind: "more" | "account" | "mobile",
    button: HTMLButtonElement,
  ) {
    trigger.current = button;
    setOpen((value) => (value === kind ? null : kind));
  }
  async function logout() {
    if (!session || logoutLock.current) return;
    logoutLock.current = true;
    setLeaving(true);
    const portal = session.portal;
    const contextCredential = sessionCandidate(pathname)?.token.startsWith("aspctx.");
    setOpen(null);
    setSession(null);
    clearPublicPortal(portal);
    const stillLoggingOut = beginPublicAuthAttempt();
    try {
      const { disconnectCallSocket } = await import("@/services/callSocket");
      if (!stillLoggingOut()) return;
      disconnectCallSocket();
      // Firebase context sessions do not own a Supabase SDK session. Waiting
      // on an unrelated provider can prevent their logout from completing.
      if (!contextCredential) {
        const { supabase } = await import("@/lib/supabase");
        if (!stillLoggingOut()) return;
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
      if (!stillLoggingOut()) return;
      if (!localStorage.getItem("asp_admin_access_token")) {
        const [{ firebaseAuth }, { signOut }] = await Promise.all([
          import("@/lib/firebaseClient"),
          import("firebase/auth"),
        ]);
        if (!stillLoggingOut()) return;
        await signOut(firebaseAuth);
      }
      if (!stillLoggingOut()) return;
      router.replace("/");
      router.refresh();
    } catch {
      if (!stillLoggingOut()) return;
      setNotice(
        "This website session has been cleared. Provider sign-out could not finish; close this browser on a shared device and sign in again when ready.",
      );
    } finally {
      logoutLock.current = false;
      setLeaving(false);
    }
  }
  const active = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");
  const accountLinks = session
    ? session.portal === "customer"
      ? [
          ["Dashboard", "/dashboard"],
          ["My profile", "/profile/complete"],
          ["Consultation history", "/consultations/history"],
          ["My cart & orders", "/marketplace/customer"],
        ]
      : session.role === "ASTROLOGER" &&
          session.nextStep === "OPEN_ASTROLOGER_DASHBOARD"
        ? [
            ["Professional dashboard", "/astrologer/dashboard"],
            ["Professional profile", "/astrologer/onboarding"],
            ["Saved Kundlis", "/astrologer/kundli/saved"],
          ]
        : [
            [
              "Application status",
              destinationFor(
                { role: session.role, nextStep: session.nextStep },
                "astrologer",
              ),
            ],
          ]
    : [];
  const authControls = (
    <>
      {leaving ? (
        <span className={s.checking} role="status">
          Signing out?
        </span>
      ) : !checked ? (
        <span className={s.checking} role="status">
          Checking account…
        </span>
      ) : session ? (
        <div className={s.accountWrap}>
          <SubscriptionNotificationBell role={session.portal === 'customer' ? 'CUSTOMER' : 'ASTROLOGER'}/>
          <button
            className={s.account}
            aria-expanded={open === "account"}
            aria-controls="account-navigation"
            onClick={(e) => toggle("account", e.currentTarget)}
          >
            <span aria-hidden="true" className={s.avatar}>
              {session.name === "Your account" ? (
                <UserRound size={16} />
              ) : (
                session.name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
              )}
            </span>
            <span>My account</span>
            <ChevronDown size={13} />
          </button>
          {open === "account" && (
            <nav
              id="account-navigation"
              data-navigation-panel
              className={s.popover}
              aria-label="Verified account navigation"
            >
              <p>
                {session.portal === "customer"
                  ? "Customer account"
                  : session.role === "ASTROLOGER"
                    ? "Astrologer account"
                    : "Application in progress"}
              </p>
              {accountLinks.map(([label, href]) => (
                <Link key={href} href={href} onClick={() => setOpen(null)}>
                  {label}
                </Link>
              ))}
              <button onClick={logout} disabled={leaving}>
                {leaving ? "Signing out…" : "Log out"}
              </button>
            </nav>
          )}
        </div>
      ) : (
        <>
          <Link
            className={s.login}
            href="/login/choose"
            onClick={() => setOpen(null)}
          >
            Login
          </Link>
          <Link
            className={s.started}
            href="/signup"
            onClick={() => setOpen(null)}
          >
            Get Started <span aria-hidden="true">↗</span>
          </Link>
        </>
      )}
    </>
  );
  return (
    <header ref={root} className={s.header}>
      <div className={s.bar}>
        <Link href="/" className={s.brand} aria-label="Astro Soul Path home">
          <span aria-hidden="true" className={s.brandMark}>
            ✧
          </span>
          <span>
            Astro<span className={s.brandGold}>Soul</span>Path
          </span>
        </Link>
        <nav className={s.desktopNav} aria-label="Main navigation">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
          <div className={s.moreWrap}>
            <button
              aria-expanded={open === "more"}
              aria-controls="more-navigation"
              onClick={(e) => toggle("more", e.currentTarget)}
            >
              More <ChevronDown size={13} />
            </button>
            {open === "more" && (
              <nav
                data-navigation-panel
                id="more-navigation"
                aria-label="More information"
                className={s.popover}
              >
                {more.map(([label, href]) => (
                  <Link key={href} href={href} onClick={() => setOpen(null)}>
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        </nav>
        <div className={s.desktopAuth}>{authControls}</div>
        <button
          className={s.mobileToggle}
          aria-label={
            open === "mobile" ? "Close navigation" : "Open navigation"
          }
          aria-expanded={open === "mobile"}
          aria-controls="mobile-navigation"
          onClick={(e) => toggle("mobile", e.currentTarget)}
        >
          {open === "mobile" ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open === "mobile" && (
        <nav
          id="mobile-navigation"
          data-navigation-panel
          className={s.mobilePanel}
          aria-label="Mobile navigation"
        >
          {[...links, ...more].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
              onClick={() => setOpen(null)}
            >
              {label}
            </Link>
          ))}
          <div className={s.mobileAuth}>
            {!checked ? (
              <span role="status">Checking account…</span>
            ) : session ? (
              <>
                {accountLinks.map(([label, href]) => (
                  <Link key={href} href={href} onClick={() => setOpen(null)}>
                    {label}
                  </Link>
                ))}
                <button onClick={logout} disabled={leaving}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login/choose" onClick={() => setOpen(null)}>
                  Login
                </Link>
                <Link
                  href="/signup"
                  className={s.started}
                  onClick={() => setOpen(null)}
                >
                  Get Started ↗
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
      {notice && (
        <p className={s.notice} role="status">
          {notice}
          <button type="button" onClick={() => setVerificationAttempt(value => value + 1)} disabled={leaving}>Retry account verification</button>
        </p>
      )}
    </header>
  );
}
