"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { sendOtp } from "@/services/authService";

type LoginFormProps = {
  redirectTo?: string;
};

export function LoginForm({
  redirectTo = "/dashboard",
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
    portal: "customer",
    redirectTo: "/dashboard",
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
    <main
      className="relative min-h-screen overflow-hidden bg-[#FBF6EC] bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/premium-login-bg.png')",
      }}
    >
      {/* Soft center veil keeps form readable without hiding artwork */}
      <div className="absolute inset-0 bg-white/[0.04]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1600px] flex-col items-center px-5 pb-10 pt-16 sm:px-8 lg:pt-20">

        {/* Center heading */}
        <section className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-[#9A6D18] sm:text-xs">
            Guided by wisdom · Powered by astrology
          </p>

          <h1
            className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-[#101936] sm:text-5xl lg:text-[56px]"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Find Clarity
            <br />
            In Life&apos;s Journey
          </h1>

          <div className="mt-5 flex items-center justify-center gap-3 text-[#B98924]">
            <span className="h-px w-16 bg-[#CDAA57]" />
            <span className="text-sm">✦</span>
            <span className="h-px w-16 bg-[#CDAA57]" />
          </div>
        </section>

        {/* Login card */}
        <section className="mt-7 w-full max-w-[430px] rounded-[26px] border border-[#E9D7AA]/70 bg-white/[0.96] p-7 shadow-[0_25px_70px_rgba(79,55,17,0.18)] backdrop-blur-sm sm:p-8">

          <div className="text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF3CE] text-[#B47E16]">
              ✦
            </div>

            <h2
              className="text-[28px] font-bold leading-tight text-[#101936]"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Welcome Back
            </h2>

            <p className="mt-1.5 text-sm text-[#687083]">
              Login to your AstroSoulPath account
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="phone"
                className="mb-2 block text-sm font-bold text-[#101936]"
              >
                Mobile number
              </label>

              <div className="flex overflow-hidden rounded-xl border border-[#D9DDE5] bg-white transition focus-within:border-[#D4AF37] focus-within:ring-4 focus-within:ring-[#D4AF37]/10">
                <div className="flex shrink-0 items-center gap-2 border-r border-[#E6E8EC] px-3.5 text-sm font-semibold text-[#101936]">
                  <span>🇮🇳</span>
                  <span>+91</span>
                </div>

                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Enter your mobile number"
                  disabled={loading}
                  className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-sm text-[#101936] outline-none placeholder:text-[#9AA1AE] disabled:bg-gray-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#D5A923] via-[#E4BB38] to-[#D5A923] py-3.5 text-sm font-bold text-[#101936] shadow-[0_9px_22px_rgba(185,137,36,0.24)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_13px_28px_rgba(185,137,36,0.30)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending OTP..." : "Continue with OTP →"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E7E7E7]" />
            <span className="text-[10px] font-semibold text-[#9299A5]">
              OR
            </span>
            <div className="h-px flex-1 bg-[#E7E7E7]" />
          </div>

          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl border border-[#DDE1E7] bg-white py-3.5 text-sm font-semibold text-[#9299A5]"
            title="Google login will be connected with OAuth"
          >
            Continue with Google — Coming Soon
          </button>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link
              href="/signup"
              className="font-bold text-[#B47E16] transition hover:text-[#8A5E0C]"
            >
              Create account
            </Link>

            <Link
              href="/"
              className="font-semibold text-[#101936] transition hover:text-[#B47E16]"
            >
              Back to Home
            </Link>
          </div>
        </section>

        {/* Trust badges */}
        <section className="mt-7 grid w-full max-w-[620px] grid-cols-3 gap-3 rounded-2xl bg-[#FFF9EC]/60 px-4 py-3 text-center backdrop-blur-[2px]">
          <div>
            <div className="text-xl text-[#A9781A]">♙</div>
            <p className="mt-1 text-[11px] font-bold text-[#101936]">
              Trusted Astrologers
            </p>
          </div>

          <div>
            <div className="text-xl text-[#A9781A]">♢</div>
            <p className="mt-1 text-[11px] font-bold text-[#101936]">
              100% Secure
            </p>
          </div>

          <div>
            <div className="text-xl text-[#A9781A]">♡</div>
            <p className="mt-1 text-[11px] font-bold text-[#101936]">
              Guidance for a Better You
            </p>
          </div>
        </section>

        <p className="mt-4 text-center text-[9px] font-bold uppercase tracking-[0.32em] text-[#896A36]">
          The stars guide, you decide
        </p>
      </div>
    </main>
  );
}
