"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ClipboardEvent, KeyboardEvent, useEffect, useState } from "react";

import {
  sendOtp,
  verifyOtp,
  verifyAstrologerOtp,
  verifyAdminOtp,
} from "@/services/authService";

type OtpContext = {
  phone: string;
  flow: "login" | "signup";
  portal?: "customer" | "astrologer" | "admin";
  redirectTo?: string;
};

const RESEND_SECONDS = 30;

export function OtpForm() {
  const router = useRouter();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const [otpContext, setOtpContext] = useState<OtpContext | null>(null);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedContext = localStorage.getItem("asp_otp_context");

    if (storedContext) {
      try {
        const parsed = JSON.parse(storedContext) as OtpContext;

        if (parsed.phone) {
          setOtpContext(parsed);
          return;
        }
      } catch {
        localStorage.removeItem("asp_otp_context");
      }
    }

    const signupData = localStorage.getItem("asp_signup_data");

    if (signupData) {
      try {
        const parsed = JSON.parse(signupData) as {
          phone?: string;
        };

        if (parsed.phone) {
          const context: OtpContext = {
            phone: parsed.phone,
            flow: "signup",
            redirectTo: "/profile/complete",
          };

          setOtpContext(context);

          localStorage.setItem("asp_otp_context", JSON.stringify(context));

          return;
        }
      } catch {
        localStorage.removeItem("asp_signup_data");
      }
    }

    setError("OTP session not found. Please request a new OTP.");
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  function focusInput(index: number) {
    document.getElementById(`otp-${index}`)?.focus();
  }

  function handleChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);

    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);
    setError("");

    if (digit && index < 5) {
      focusInput(index + 1);
    }
  }

  function handleKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      focusInput(index - 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();

    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6)
      .split("");

    if (!digits.length) {
      return;
    }

    const nextOtp = Array.from(
      { length: 6 },
      (_, index) => digits[index] ?? "",
    );

    setOtp(nextOtp);
    focusInput(Math.min(digits.length, 5));
  }

  async function handleVerify() {
    setError("");

    const code = otp.join("");

    if (code.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    if (!otpContext?.phone) {
      setError("OTP session not found. Please request a new OTP.");
      return;
    }

    try {
      setLoading(true);

      let response: any;

      if (otpContext.portal === "astrologer") {
        response = await verifyAstrologerOtp(otpContext.phone, code);
      } else if (otpContext.portal === "admin") {
        response = await verifyAdminOtp(otpContext.phone, code);
      } else {
        response = await verifyOtp(otpContext.phone, code);
      }

      const accessToken =
        response.session?.accessToken ||
        (response as { accessToken?: string }).accessToken;

      const refreshToken =
        response.session?.refreshToken ||
        (response as { refreshToken?: string }).refreshToken;

      const portal = otpContext.portal ?? "customer";

      /*
       * Keep only the active portal session. Otherwise, a stale astrologer
       * token can be selected while a customer opens consultation/chat.
       */
      const portalSessionKeys = [
        "asp_access_token",
        "asp_refresh_token",
        "asp_customer_access_token",
        "asp_customer_refresh_token",
        "asp_astrologer_access_token",
        "asp_astrologer_refresh_token",
        "asp_admin_access_token",
        "asp_admin_refresh_token",
        "access_token",
        "refresh_token",
      ];

      portalSessionKeys.forEach((key) => {
        localStorage.removeItem(key);
      });

      const accessTokenKey =
        portal === "astrologer"
          ? "asp_astrologer_access_token"
          : portal === "admin"
            ? "asp_admin_access_token"
            : "asp_customer_access_token";

      const refreshTokenKey =
        portal === "astrologer"
          ? "asp_astrologer_refresh_token"
          : portal === "admin"
            ? "asp_admin_refresh_token"
            : "asp_customer_refresh_token";

      if (accessToken) {
        localStorage.setItem(accessTokenKey, accessToken);
      }

      if (refreshToken) {
        localStorage.setItem(refreshTokenKey, refreshToken);
      }

      // Compatibility for existing customer dashboard and services.
      // Astrologer and admin tokens are not saved in these customer keys.
      if (portal === "customer" && accessToken) {
        localStorage.setItem("asp_access_token", accessToken);
      }

      if (portal === "customer" && refreshToken) {
        localStorage.setItem("asp_refresh_token", refreshToken);
      }

      let savedUser: any =
        portal === "customer"
          ? {
              ...response.user,
              role: "CUSTOMER",
              accountRole: "USER",
              portal: "customer",
              isAstrologer: false,
            }
          : response.user;

      if (portal === "astrologer") {
        savedUser = {
          id: response.astrologerId,
          phone: otpContext.phone,
          role: "ASTROLOGER",
          portal: "astrologer",
          astrologer: response.astrologer,
          nextStep: response.nextStep,
        };
      }

      if (savedUser) {
        const userData = JSON.stringify(savedUser);

        localStorage.setItem("asp_user", userData);

        document.cookie = `asp_user=${encodeURIComponent(
          userData,
        )}; path=/; max-age=86400; SameSite=Lax`;
      }

      const isCustomerLogin = portal === "customer";

      if (isCustomerLogin && response.user?.freeChat?.showPopup === true) {
        sessionStorage.setItem(
          "asp_free_chat_popup_pending",
          JSON.stringify(response.user.freeChat),
        );

        window.dispatchEvent(new Event("asp-free-chat-popup"));
      }

      if (portal === "astrologer") {
        localStorage.removeItem("asp_otp_context");

        if (response.nextStep === "COMPLETE_ASTROLOGER_ONBOARDING") {
          router.replace("/astrologer/onboarding");
          return;
        }

        if (response.nextStep === "WAIT_FOR_ADMIN_APPROVAL") {
          router.replace("/astrologer/pending");
          return;
        }

        if (response.nextStep === "OPEN_ASTROLOGER_DASHBOARD") {
          router.replace("/astrologer/dashboard");
          return;
        }

        router.replace("/astrologer/onboarding");
        return;
      }

      if (portal === "admin") {
        localStorage.removeItem("asp_otp_context");

        if (response.nextStep === "OPEN_ADMIN_DASHBOARD") {
          router.replace("/admin");
          return;
        }

        router.replace("/admin");
        return;
      }

      localStorage.removeItem("asp_otp_context");

      const postLoginRedirect = localStorage.getItem("asp_post_login_redirect");

      if (postLoginRedirect === "/astrologer/register") {
        localStorage.removeItem("asp_post_login_redirect");
        localStorage.removeItem("asp_signup_data");

        router.replace("/astrologer/register");
        return;
      }

      if (otpContext.flow === "signup") {
        localStorage.removeItem("asp_signup_data");
        router.replace("/profile/complete");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
      return;
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "OTP verification failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || !otpContext?.phone || resending) {
      return;
    }

    try {
      setResending(true);
      setError("");

      await sendOtp(otpContext.phone);

      setOtp(["", "", "", "", "", ""]);
      setSecondsLeft(RESEND_SECONDS);
      focusInput(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to resend OTP.");
    } finally {
      setResending(false);
    }
  }

  const maskedPhone = otpContext?.phone
    ? `${otpContext.phone.slice(0, -4).replace(/\d/g, "•")}${otpContext.phone.slice(-4)}`
    : "your phone";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAF7F0] px-6 py-20">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg sm:p-10">
        <h1 className="text-3xl font-bold text-[#0B1026] sm:text-4xl">
          Verify OTP
        </h1>

        <p className="mt-3 text-gray-600">
          Enter the 6-digit code sent to {maskedPhone}.
        </p>

        {error && (
          <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-8 grid grid-cols-6 gap-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              id={`otp-${index}`}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              disabled={loading}
              onChange={(event) => handleChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              onPaste={handlePaste}
              aria-label={`OTP digit ${index + 1}`}
              className="h-14 min-w-0 rounded-xl border border-gray-300 text-center text-xl font-bold outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => void handleVerify()}
          disabled={loading || !otpContext}
          className="mt-8 w-full rounded-xl bg-[#D4AF37] py-4 font-semibold text-[#0B1026] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>

        <div className="mt-6 flex items-center justify-between gap-4 text-sm">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={secondsLeft > 0 || resending || !otpContext}
            className="font-semibold text-[#D4AF37] disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {resending
              ? "Sending..."
              : secondsLeft > 0
                ? `Resend in ${secondsLeft}s`
                : "Resend OTP"}
          </button>

          <Link href="/login" className="font-medium text-[#0B1026]">
            Change number
          </Link>
        </div>
      </div>
    </main>
  );
}
