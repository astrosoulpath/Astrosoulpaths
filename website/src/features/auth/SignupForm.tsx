"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { sendOtp } from "@/services/authService";

export function SignupForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!fullName || !email || !phone || !password) {
      setError("Please fill all fields.");
      return;
    }

    try {
      setLoading(true);

      await sendOtp(phone);

      localStorage.setItem(
        "asp_signup_data",
        JSON.stringify({
          fullName,
          email,
          phone,
          password,
        })
      );

      router.push("/verify-otp");
    } catch {
      setError("OTP send failed. Please check backend and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-[#0B1026]">Create Account</h1>

        <p className="mt-2 text-[#374151]">Join AstroSoulPath</p>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <input
            type="text"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37]"
          />

          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37]"
          />

          <div className="rounded-xl border border-gray-300 px-4 py-3 focus-within:border-[#D4AF37]">
            <PhoneInput
              international
              defaultCountry="IN"
              value={phone}
              onChange={setPhone}
              placeholder="Enter phone number"
              className="outline-none"
            />
          </div>

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37]"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#D4AF37] py-3 font-semibold text-[#0B1026] disabled:opacity-60"
          >
            {loading ? "Sending OTP..." : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#374151]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#D4AF37]">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}