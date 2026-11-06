"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  ChartNoAxesCombined,
  ChartPie,
  LockKeyhole,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import styles from "./admin-login.module.css";


import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { firebaseAuth } from "@/lib/firebaseClient";
import {
  beginAdminLogin,
  establishAdminSession,
  logoutAdmin,
} from "@/features/admin/auth/admin-session";

export default function AdminLoginPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      await beginAdminLogin();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(firebaseAuth, provider);
      await establishAdminSession(await result.user.getIdToken(true), "google");
      router.replace("/admin");
      router.refresh();
    } catch (error: unknown) {
      try {
        await logoutAdmin();
      } catch {
        /* Keep the original sign-in error visible. */
      }
      const code = (error as { code?: string })?.code;
      setMessage(
        code === "auth/popup-closed-by-user"
          ? "Google sign-in was cancelled."
          : code === "auth/popup-blocked"
            ? "Allow popups for this website and try Google sign-in again."
            : error instanceof Error
              ? error.message
              : "Google Admin sign-in failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.scene}>
      <div className={styles.layout}>
        <section
          className={styles.introduction}
          aria-labelledby="admin-brand-title"
        >
          <h1 id="admin-brand-title" className={styles.brand}>
            Astro <span>Soul Path</span>
          </h1>
          <p className={styles.tagline}>Guidance for a better you</p>
          <ul className={styles.highlights} aria-label="Admin portal features">
            {[
              { Icon: ShieldCheck, label: "Secure Access" },
              { Icon: ChartNoAxesCombined, label: "Manage Platform" },
              { Icon: Users, label: "Support Astrologers" },
              { Icon: Settings, label: "Monitor Operations" },
            ].map(({ Icon, label }) => (
              <li key={label}>
                <span className={styles.featureIcon}>
                  <Icon aria-hidden="true" size={27} strokeWidth={1.8} />
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <div className={styles.artwork} aria-hidden="true">
            <Image
              src="/images/admin/login-reference.png"
              alt=""
              width={1644}
              height={957}
              sizes="(max-width: 900px) 1px, (max-width: 1400px) 1200px, 1500px"
              quality={75}
              className={styles.artworkImage}
            />
          </div>
        </section>

        <section
          className={styles.card}
          aria-labelledby="admin-welcome-title"
          aria-busy={loading}
        >
          <div className={styles.moon} aria-hidden="true">
            <svg
              viewBox="0 0 80 90"
              width="64"
              height="72"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M61 9a34 34 0 1 0 0 65 37 37 0 0 1 0-65Z" />
            </svg>
            <Sparkles size={25} strokeWidth={1} />
          </div>
          <svg
            className={styles.lotus}
            viewBox="0 0 64 56"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="M32 45C17 32 24 13 32 5c8 8 15 27 0 40Z" />
            <path d="M32 45C13 45 7 30 8 20c12 0 22 6 24 25ZM32 45c19 0 25-15 24-25-12 0-22 6-24 25Z" />
            <path d="M32 45C17 51 8 44 3 35c12-4 23-2 29 10ZM32 45c15 6 24-1 29-10-12-4-23-2-29 10ZM32 45v8" />
          </svg>
          <p className={styles.eyebrow}>
            <span />
            Admin Portal
            <span />
          </p>
          <h2 id="admin-welcome-title" className={styles.welcome}>
            Welcome Back
          </h2>
          <p className={styles.subtitle}>
            Sign in to access the Astro Soul Path admin dashboard
          </p>

          {message && (
            <div role="alert" aria-live="polite" className={styles.error}>
              {message}
            </div>
          )}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className={styles.googleButton}
          >
            <span className={styles.googleIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.58-4.13H3.08v2.59A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.42 13.91a6 6 0 0 1 0-3.82V7.5H3.08a10 10 0 0 0 0 9l3.34-2.59Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.57 9.57 0 0 0 12 2a10 10 0 0 0-8.92 5.5l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
                />
              </svg>
            </span>
            <span className={styles.googleLabel}>
              {loading ? "Signing in..." : "Continue with Google"}
            </span>
            <span className={styles.buttonArrow} aria-hidden="true">
              <ArrowRight size={25} strokeWidth={1.6} />
            </span>
          </button>
          <div className={styles.security}>
            <span className={styles.lock}>
              <LockKeyhole size={28} aria-hidden="true" />
            </span>
            <div>
              <h3>Secure Access</h3>
              <p>
                Only authorized Astro Soul Path administrators can access this
                portal.
              </p>
            </div>
          </div>
          <div className={styles.divider} aria-hidden="true">
            <span />
            <svg viewBox="0 0 20 24" width="20" height="24" fill="currentColor">
              <path d="M10 0c1 8 3 10 10 12-7 2-9 4-10 12C9 16 7 14 0 12 7 10 9 8 10 0Z" />
            </svg>
            <span />
          </div>
          <ul
            className={styles.capabilities}
            aria-label="Platform administration"
          >
            {[
              { Icon: ChartPie, label: "Platform Analytics" },
              { Icon: Users, label: "Astrologer Management" },
              { Icon: Settings, label: "System Operations" },
            ].map(({ Icon, label }) => (
              <li key={label}>
                <Icon size={28} strokeWidth={1.7} aria-hidden="true" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
