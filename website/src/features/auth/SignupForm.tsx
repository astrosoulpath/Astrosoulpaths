"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import PhoneInput from "react-phone-number-input";
import { AuthShell } from "./AuthShell";
import {
  beginPublicAuthAttempt,
  commitPortalSession,
  destinationFor,
  publicAuthRequest,
  signupErrors,
} from "./public-auth";
import s from "./auth-premium.module.css";
export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState(""),
    [email, setEmail] = useState(""),
    [phone, setPhone] = useState<string | undefined>(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [verification, setVerification] = useState(false);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current) return;
    setError("");
    const invalid = signupErrors({
      fullName,
      email,
      phone: phone ?? "",
      password,
    });
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      document.getElementById("signup-" + Object.keys(invalid)[0])?.focus();
      return;
    }
    lock.current = true;
    setBusy(true);
    const current = beginPublicAuthAttempt();
    try {
      const result = await publicAuthRequest("/auth/email/signup", {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone,
        password,
      });
      if (!alive.current || !current()) return;
      setPassword("");
      localStorage.removeItem("asp_signup_data");
      if (result.nextStep === "VERIFY_EMAIL") {
        setVerification(true);
        return;
      }
      commitPortalSession(result, "customer");
      router.replace(destinationFor(result, "customer"));
      router.refresh();
    } catch (err) {
      if (alive.current && current())
        setError(
          err instanceof Error
            ? err.message
            : "Registration could not be confirmed. Check your details and connection before retrying.",
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const invalid = (key: string) => ({
    "aria-invalid": !!errors[key],
    "aria-describedby": errors[key] ? "error-" + key : undefined,
  });
  return (
    <AuthShell
      eyebrow="Begin your journey"
      title="Create your account"
      description="One customer account for the existing Astro Soul Path experiences."
    >
      {verification ? (
        <div className={s.success} role="status">
          <strong>Check your email to continue.</strong>
          <p>
            The server requires email verification before sign-in. Follow the
            verification instructions sent by the existing account provider.
          </p>
          <Link href="/login?method=email">Return to Customer Login ↗</Link>
        </div>
      ) : (
        <>
          {error && (
            <p className={s.error} role="alert">
              {error}
            </p>
          )}
          <form
            className={s.form}
            onSubmit={submit}
            noValidate
            aria-busy={busy}
          >
            <div className={s.field}>
              <label htmlFor="signup-fullName">Full name</label>
              <input
                id="signup-fullName"
                name="fullName"
                autoComplete="name"
                value={fullName}
                maxLength={100}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                disabled={busy}
                {...invalid("fullName")}
              />
              {errors.fullName && (
                <small className={s.fieldError} id="error-fullName">
                  {errors.fullName}
                </small>
              )}
            </div>
            <div className={s.field}>
              <label htmlFor="signup-email">Email address</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={busy}
                {...invalid("email")}
              />
              {errors.email && (
                <small className={s.fieldError} id="error-email">
                  {errors.email}
                </small>
              )}
            </div>
            <div className={s.field}>
              <label htmlFor="signup-phone">Phone number</label>
              <div className={s.phone}>
                <PhoneInput
                  id="signup-phone"
                  name="phone"
                  autoComplete="tel"
                  flagComponent={({ country }) => (
                    <span style={{ fontSize: 10, fontWeight: 650 }}>
                      {country}
                    </span>
                  )}
                  international
                  defaultCountry="IN"
                  value={phone}
                  onChange={setPhone}
                  placeholder="Your international phone number"
                  disabled={busy}
                  {...invalid("phone")}
                />
              </div>
              {errors.phone && (
                <small className={s.fieldError} id="error-phone">
                  {errors.phone}
                </small>
              )}
            </div>
            <div className={s.field}>
              <label htmlFor="signup-password">Password</label>
              <div className={s.password}>
                <input
                  id="signup-password"
                  name="password"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  maxLength={72}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  {...invalid("password")}
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  aria-pressed={show}
                  onClick={() => setShow((v) => !v)}
                  disabled={busy}
                >
                  {show ? "Hide" : "Show"}
                </button>
              </div>
              <small id="password-guidance">
                8–72 characters, including uppercase, lowercase, a number and a
                symbol.
              </small>
              {errors.password && (
                <small className={s.fieldError} id="error-password">
                  {errors.password}
                </small>
              )}
            </div>
            <button className={s.submit} type="submit" disabled={busy}>
              {busy ? "Creating account…" : "Create Customer Account ↗"}
            </button>
          </form>
        </>
      )}
      <div className={s.alternate}>
        <span>Already have an account?</span>
        <Link href="/login">Customer Login</Link>
      </div>
      <div className={s.alternate}>
        <span>Joining as a professional?</span>
        <Link href="/astrologer/register">Apply as Astrologer</Link>
      </div>
    </AuthShell>
  );
}
