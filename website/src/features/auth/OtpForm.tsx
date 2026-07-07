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

  const handleChange = (
    index: number,
    value: string,
  ) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      const next = document.getElementById(
        `otp-${index + 1}`,
      ) as HTMLInputElement;

      next?.focus();
    }
  };

  async function handleVerify() {
    setError("");

    const code = otp.join("");

    if (code.length !== 6) {
      setError("Please enter 6 digit OTP.");
      return;
    }

    try {
      setLoading(true);

      const signup = localStorage.getItem("asp_signup_data");

      if (!signup) {
        setError("Signup data not found.");
        return;
      }

      const { phone } = JSON.parse(signup);

      await verifyOtp(phone, code);

      alert("OTP Verified Successfully.");

      router.push("/");
    } catch (err: any) {
      setError(
        err?.message || "OTP verification failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    alert(
      "Resend OTP will be connected in next step."
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center bg-[#FAF7F0] px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-lg">
        <h1 className="text-5xl font-bold text-[#0B1026]">
          Verify OTP
        </h1>

        <p className="mt-3 text-[#374151]">
          Enter the 6-digit verification code sent to your
          phone.
        </p>

        {error && (
          <div className="mt-5 rounded-xl bg-red-100 p-3 text-red-600">
            {error}
          </div>
        )}

        <div className="mt-8 flex justify-between gap-3">
          {otp.map((digit, index) => (
            <input
              key={index}
              id={`otp-${index}`}
              value={digit}
              maxLength={1}
              onChange={(e) =>
                handleChange(index, e.target.value)
              }
              className="h-14 w-14 rounded-xl border text-center text-2xl outline-none focus:border-[#D4AF37]"
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          disabled={loading}
          className="mt-8 w-full rounded-xl bg-[#D4AF37] py-4 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify OTP"}
        </button>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
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