"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { sendOtp } from "@/services/authService";

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({
  redirectTo = "/",
}: LoginFormProps) {
  const router = useRouter();

  const [phone, setPhone] = useState("+91");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");

    const normalizedPhone = phone.replace(/[^\d+]/g, "");

    if (!/^\+?[1-9]\d{9,14}$/.test(normalizedPhone)) {
      setError(
        "Please enter a valid phone number with country code.",
      );
      return;
    }

    try {
      setLoading(true);

      await sendOtp(normalizedPhone);

      localStorage.setItem(
        "asp_otp_context",
        JSON.stringify({
          phone: normalizedPhone,
          flow: "login",
          redirectTo:
            redirectTo.startsWith("/") ? redirectTo : "/",
        }),
      );

      router.push("/verify-otp");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to send OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-6 py-20">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-[#0B1026]">
          Login
        </h1>

        <p className="mt-2 text-gray-600">
          Continue securely using your mobile number.
        </p>

        {error && (
          <div className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <div>
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-semibold text-[#0B1026]"
            >
              Mobile number
            </label>

            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              placeholder="+91 98765 43210"
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#D4AF37] py-3 font-semibold text-[#0B1026] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending OTP..." : "Continue with OTP"}
          </button>
        </form>

        <div className="my-7 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium text-gray-400">
            OR
          </span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-xl border border-gray-300 py-3 font-semibold text-gray-400"
          title="Google login will be connected with OAuth"
        >
          Continue with Google — Coming Soon
        </button>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link
            href="/signup"
            className="font-semibold text-[#D4AF37]"
          >
            Create account
          </Link>

          <Link
            href="/"
            className="font-medium text-[#0B1026]"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}