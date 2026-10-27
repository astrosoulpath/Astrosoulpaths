"use client";

import { FormEvent, useRef, useState } from "react";
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

import PhoneInput, {
  isValidPhoneNumber,
  type Value,
} from "react-phone-number-input";

import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithEmailAndPassword,
} from "firebase/auth";

import { firebaseAuth } from "@/lib/firebaseClient";
import {
  beginAdminLogin,
  establishAdminSession,
  logoutAdmin,
} from "@/features/admin/auth/admin-session";

export default function AdminLoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState<Value>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

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

  const handleEmailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    try {
      await beginAdminLogin();
      const credential = await signInWithEmailAndPassword(firebaseAuth, adminEmail.trim(), adminPassword);
      await establishAdminSession(await credential.user.getIdToken(true), "password");
      setAdminPassword("");

      router.replace("/admin");
      router.refresh();
    } catch (error: unknown) {
      try { await logoutAdmin(); } catch { /* Preserve the login failure below. */ }
      setMessage(
        error instanceof Error ? error.message : "Admin login failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    const normalizedPhone = phone?.trim() ?? "";

    if (!normalizedPhone) {
      setMessage("Please enter your mobile number.");
      return;
    }

    if (!isValidPhoneNumber(normalizedPhone)) {
      setMessage(
        "Please enter a valid mobile number for the selected country.",
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      await beginAdminLogin();

      /*
       * react-phone-number-input returns E.164:
       * India  -> +918651540070
       * USA    -> +12025550123
       * UK     -> +447911123456
       *
       * Same backend-compatible format as Flutter.
       */
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }

      const verifier = new RecaptchaVerifier(
        firebaseAuth,
        "admin-recaptcha-container",
        {
          size: "normal",
        },
      );

      recaptchaRef.current = verifier;

      const confirmationResult = await signInWithPhoneNumber(
        firebaseAuth,
        normalizedPhone,
        verifier,
      );

      window.sessionStorage.setItem("admin_phone", normalizedPhone);

      window.sessionStorage.setItem(
        "admin_firebase_verification_id",
        confirmationResult.verificationId,
      );

      router.push("/admin/verify-otp");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "OTP send failed.");
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
          <div data-admin-email-auth>
            <form onSubmit={handleEmailLogin}>
              <div className="mt-6">
                <label
                  htmlFor="admin-email"
                  className="text-sm font-medium text-[#0b1026]"
                >
                  Admin Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-black"
                  placeholder="Enter admin email"
                />
              </div>

              <div className="mt-4">
                <label
                  htmlFor="admin-password"
                  className="text-sm font-medium text-[#0b1026]"
                >
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-black"
                  placeholder="Enter password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-[#D4AF37] py-4 font-semibold text-black disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Login as Admin"}
              </button>
            </form>

          </div>
          {/* Preserve the retired Phone flow source without exposing it. */}
          <div hidden className="hidden" aria-hidden="true" data-admin-legacy-auth>
            <p className="mt-6 text-center text-sm text-gray-500">
              Or continue with phone OTP
            </p>
            <form onSubmit={handleLogin} noValidate>
              <div className="mt-6">
                <label
                  htmlFor="admin-phone"
                  className="text-sm font-medium text-[#0b1026]"
                >
                  Mobile Number
                </label>

                <div className="asp-phone-field mt-2">
                  <PhoneInput
                    id="admin-phone"
                    /*
                     * Flutter default:
                     * _selectedPhoneCode = '91'
                     * _selectedCountryCode = 'IN'
                     * _selectedCountryFlag = India
                     */
                    defaultCountry="IN"
                    /*
                     * Shows:
                     * flag + international calling code.
                     *
                     * User cannot manually corrupt +91/+1/+44 etc.
                     */
                    international
                    countryCallingCodeEditable={false}
                    value={phone}
                    onChange={(value) => {
                      setPhone(value);
                      setMessage("");
                    }}
                    disabled={loading}
                    autoComplete="tel"
                    placeholder="Enter mobile number"
                    className="asp-phone-input"
                  />
                </div>

                <p className="mt-2 text-xs text-gray-400">
                  Select your country code and enter your mobile number.
                </p>
              </div>

              <div id="admin-recaptcha-container" className="mt-4" />
              <button
                id="admin-send-otp-button"
                type="submit"
                disabled={loading || !phone}
                className="mt-6 w-full rounded-xl bg-[#D4AF37] py-4 font-semibold text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Sending OTP..." : "Continue with OTP"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
