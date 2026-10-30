"use client";
import { firebaseEmailPortalLogin } from "./firebase-email-login";
import { websitePhoneAuthEnabled } from "./website-auth-policy";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import PhoneInput from "react-phone-number-input";
import { sendOtp, sendAstrologerOtp } from "@/services/authService";
import { AuthShell } from "./AuthShell";
import {
  beginPublicAuthAttempt,
  commitPortalSession,
  destinationFor,
  publicAuthRequest,
  safeCustomerRedirect,
  type Portal,
  type SessionResult,
} from "./public-auth";
import { googlePortalLogin, hasGoogleRedirect } from "./google-portal-login";
import s from "./auth-premium.module.css";
export function PortalLoginForm({
  portal,
  redirectTo = "/dashboard",
  initialMethod = "email",
}: {
  portal: Portal;
  redirectTo?: string;
  initialMethod?: "phone" | "email";
}) {
  const router = useRouter(),
    professional = portal === "astrologer";
  const [method, setMethod] = useState<"phone" | "email">(websitePhoneAuthEnabled ? initialMethod : "email"),
    [phone, setPhone] = useState<string | undefined>(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [emailProvider, setEmailProvider] = useState<"legacy" | "firebase">(
    professional ? "firebase" : "legacy",
  );
  const lock = useRef(false),
    alive = useRef(true);
  const [redirectSuggested, setRedirectSuggested] = useState(false);
  const [redirectPending, setRedirectPending] = useState(false);
  useEffect(() => {
    alive.current = true;
    setRedirectPending(hasGoogleRedirect(portal));
    return () => {
      alive.current = false;
    };
  }, [portal]);
  function enter(result: SessionResult) {
    commitPortalSession(result, portal);
    setPassword("");
    const pending = localStorage.getItem("asp_post_login_redirect");
    const returnTo = safeCustomerRedirect(redirectTo);
    const destination = destinationFor(
      result,
      portal,
      pending === "/astrologer/register" ? pending : returnTo,
    );
    if (destination === "/profile/complete")
      sessionStorage.setItem(
        "asp_after_profile_redirect",
        JSON.stringify({ userId: result.user?.id, path: returnTo }),
      );
    if (
      portal === "customer" &&
      result.user?.freeChat &&
      typeof result.user.freeChat === "object" &&
      (result.user.freeChat as { showPopup?: boolean }).showPopup === true
    ) {
      sessionStorage.setItem(
        "asp_free_chat_popup_pending",
        JSON.stringify(result.user.freeChat),
      );
      window.dispatchEvent(new Event("asp-free-chat-popup"));
    }
    localStorage.removeItem("asp_post_login_redirect");
    router.replace(destination);
    router.refresh();
  }
  async function submit(e?: FormEvent<HTMLFormElement>, google: boolean | "redirect" | "complete" = false) {
    e?.preventDefault();
    if (lock.current) return;
    setError("");
    if (!google) {
      if (method === "phone" && !websitePhoneAuthEnabled) {
        setError("Use Google or email to sign in on this website.");
        return;
      }
      if (method === "phone" && !/^\+[1-9]\d{9,14}$/.test(phone ?? "")) {
        setError(
          "Enter a valid international phone number including the country code.",
        );
        return;
      }
      if (
        method === "email" &&
        (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          password.length < 8 ||
          password.length > 72)
      ) {
        setError("Enter your email and existing password (8–72 characters).");
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    const current = beginPublicAuthAttempt();
    try {
      if (google) {
        const result = await googlePortalLogin(portal, google === true ? "popup" : google, current);
        if (result && alive.current && current()) enter(result);
      } else if (method === "email") {
        const result =
          emailProvider === "firebase"
            ? await firebaseEmailPortalLogin(email, password, portal)
            : await publicAuthRequest("/auth/email/login", {
                email: email.trim().toLowerCase(),
                password,
              });
        if (alive.current && current()) enter(result);
      } else {
        await (professional ? sendAstrologerOtp(phone!) : sendOtp(phone!));
        if (!alive.current || !current()) return;
        localStorage.setItem(
          "asp_otp_context",
          JSON.stringify({
            phone,
            flow: "login",
            portal,
            redirectTo: professional
              ? "/astrologer/dashboard"
              : safeCustomerRedirect(redirectTo),
          }),
        );
        router.push("/verify-otp");
      }
    } catch (err) {
      if (alive.current && current()) {
        setRedirectSuggested(err instanceof Error && err.name === "GoogleRedirectRecommended");
        setRedirectPending(hasGoogleRedirect(portal));
      }
      if (alive.current && current())
        setError(
          google && err instanceof Error
            ? err.message
            : "Sign-in could not be completed. Check your details, account verification and connection before retrying.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <AuthShell
      eyebrow={professional ? "Your professional space" : "Welcome back"}
      title={professional ? "Astrologer Login" : "Customer Login"}
      description={
        professional
          ? "Return to your existing professional account. Your server-verified approval state determines the next step."
          : "Continue to your consultations, readings and account using your existing sign-in method."
      }
      professional={professional}
    >
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <div className={s.methods} role="group" aria-label="Sign-in method">
        {websitePhoneAuthEnabled && <button
          type="button"
          aria-pressed={method === "phone"}
          disabled={busy}
          onClick={() => {
            setMethod("phone");
            setError("");
          }}
        >
          Phone OTP
        </button>}
        {
          <button
            type="button"
            aria-pressed={method === "email"}
            disabled={busy}
            onClick={() => {
              setMethod("email");
              setError("");
            }}
          >
            Email & password
          </button>
        }
      </div>
      <form
        method="post"
        className={s.form}
        onSubmit={(e) => void submit(e)}
        aria-busy={busy}
        noValidate
      >
        {websitePhoneAuthEnabled && method === "phone" ? (
          <div className={s.field}>
            <label htmlFor="login-phone">Phone number</label>
            <div className={s.phone}>
              <PhoneInput
                id="login-phone"
                name="phone"
                flagComponent={({ country }) => (
                  <span style={{ fontSize: 10, fontWeight: 650 }}>
                    {country}
                  </span>
                )}
                international
                defaultCountry="IN"
                autoComplete="tel"
                value={phone}
                onChange={setPhone}
                disabled={busy}
                placeholder="Your international phone number"
              />
            </div>
            <small>
              We will request a code through the existing phone verification
              service.
            </small>
          </div>
        ) : (
          <>
            {!professional && (
              <div className={s.field}>
                <label htmlFor="email-account-type">Email account type</label>
                <select
                  id="email-account-type"
                  value={emailProvider}
                  onChange={(e) =>
                    setEmailProvider(e.target.value as "legacy" | "firebase")
                  }
                  disabled={busy}
                >
                  <option value="legacy">Website email account</option>
                  <option value="firebase">
                    Existing app / Firebase email account
                  </option>
                </select>
                <small>
                  Choose the method used to register. Accounts are never merged
                  automatically.
                </small>
              </div>
            )}
            <div className={s.field}>
              <label htmlFor="login-email">Email address</label>
              <input
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                maxLength={254}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className={s.field}>
              <label htmlFor="login-password">Password</label>
              <div className={s.password}>
                <input
                  id="login-password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-pressed={show}
                  aria-label={show ? "Hide password" : "Show password"}
                  disabled={busy}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </>
        )}
        <button type="submit" className={s.submit} disabled={busy}>
          {busy
            ? "Please wait…"
            : method === "phone"
              ? "Continue with OTP ↗"
              : "Sign in securely ↗"}
        </button>
      </form>
      <div className={s.divider}>or continue with</div>
      <button
        type="button"
        className={s.google}
        disabled={busy}
        onClick={() => void submit(undefined, true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.38Z" />
          <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.39l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22Z" />
          <path fill="#FBBC05" d="M6.42 13.93a6 6 0 0 1 0-3.86v-2.6H3.08a10 10 0 0 0 0 9.06l3.34-2.6Z" />
          <path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.92 5.47l3.34 2.6C7.2 7.7 9.4 5.95 12 5.95Z" />
        </svg>
        Continue with Google
      </button>
      {redirectSuggested && <button type="button" className={s.google} disabled={busy} onClick={() => void submit(undefined, "redirect")}>Continue with Google using redirect</button>}
      {redirectPending && <button type="button" className={s.google} disabled={busy} onClick={() => void submit(undefined, "complete")}>Finish Google sign-in</button>}
      <div className={s.alternate}>
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href={professional ? "/astrologer/register" : "/signup"}>
          {professional ? "Apply as Astrologer" : "Create an account"}
        </Link>
        <Link href={professional ? "/login" : "/forgot-password"}>
          {professional ? "Customer Login" : "Need help signing in?"}
        </Link>
      </div>
      <div className={s.alternate}>
        <Link href="/login/choose">Choose another account experience</Link>
        <Link href="/">Back to Home</Link>
      </div>
    </AuthShell>
  );
}
