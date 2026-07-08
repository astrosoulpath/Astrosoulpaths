"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { verifyOtp } from "@/services/authService";

export function OtpForm() {
  const router = useRouter();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const next = document.getElementById(
        `otp-${index + 1}`
      ) as HTMLInputElement | null;

      next?.focus();
    }
  };

  async function handleVerify() {
    setError("");

    const code = otp.join("");

    if (code.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      const signupData = localStorage.getItem("asp_signup_data");

      if (!signupData) {
        setError("Signup data not found. Please signup again.");
        return;
      }

      const { phone } = JSON.parse(signupData);

      const response = await verifyOtp(phone, code);

      // Save Session
      if (response?.session) {
        localStorage.setItem(
          "asp_access_token",
          response.session.accessToken
        );

        localStorage.setItem(
          "asp_refresh_token",
          response.session.refreshToken
        );
      }

      // Save User
      if (response?.user) {
        localStorage.setItem(
          "asp_user",
          JSON.stringify(response.user)
        );
      }

      // Remove temporary signup data
      localStorage.removeItem("asp_signup_data");

      // ASP Flow
      router.push("/profile/complete");
    } catch (err: any) {
      setError(
        err?.message ||
          "OTP verification failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    alert("Resend OTP will be connected in the next step.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF7F0] px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-lg">
        <h1 className="text-4xl font-bold text-[#0B1026]">
          Verify OTP
        </h1>

        <p className="mt-3 text-[#374151]">
          Enter the 6-digit verification code sent to your phone.
        </p>

        {error && (
          <div className="mt-5 rounded-xl bg-red-100 p-3 text-red-600">
            {error}
          </div>
        )}

        <div className="mt-8 flex justify-between gap-2">
          {otp.map((digit, index) => (
            <input
              key={index}
              id={`otp-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) =>
                handleChange(index, e.target.value)
              }
              className="h-14 w-14 rounded-xl border border-gray-300 text-center text-2xl outline-none focus:border-[#D4AF37]"
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-[#D4AF37] py-4 font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={handleResend}
            className="text-[#D4AF37] hover:underline"
          >
            Resend OTP
          </button>

          <Link
            href="/login"
            className="text-[#D4AF37] hover:underline"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}