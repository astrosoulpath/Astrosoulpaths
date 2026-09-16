"use client";

import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  saveAuthSession,
  verifyAdminOtp,
} from "@/services/authService";

const OTP_LENGTH = 6;

export default function AdminVerifyOtpPage() {
  const router = useRouter();

  const [otp, setOtp] = useState<string[]>(
    Array(OTP_LENGTH).fill(""),
  );
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const savedPhone =
      window.sessionStorage.getItem("admin_phone")?.trim() ?? "";

    if (!savedPhone) {
      router.replace("/admin/login");
      return;
    }

    setPhone(savedPhone);
    inputRefs.current[0]?.focus();
  }, [router]);

  const updateDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);

    const updatedOtp = [...otp];
    updatedOtp[index] = digit;
    setOtp(updatedOtp);
    setMessage("");

    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) => {
    if (event.key === "Backspace") {
      if (otp[index]) {
        const updatedOtp = [...otp];
        updatedOtp[index] = "";
        setOtp(updatedOtp);
        return;
      }

      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (
      event.key === "ArrowRight" &&
      index < OTP_LENGTH - 1
    ) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (
    event: ClipboardEvent<HTMLInputElement>,
  ) => {
    event.preventDefault();

    const pastedOtp = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (!pastedOtp) {
      return;
    }

    const updatedOtp = Array(OTP_LENGTH).fill("");

    pastedOtp.split("").forEach((digit, index) => {
      updatedOtp[index] = digit;
    });

    setOtp(updatedOtp);
    setMessage("");

    const nextIndex = Math.min(
      pastedOtp.length,
      OTP_LENGTH - 1,
    );

    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerifyOtp = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const token = otp.join("");

    if (!phone) {
      setMessage(
        "Admin phone number missing. Please login again.",
      );
      router.replace("/admin/login");
      return;
    }

    if (!/^\d{6}$/.test(token)) {
      setMessage("Please enter the complete 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await verifyAdminOtp(phone, token);

     if (response.user?.role !== "ADMIN") {
  throw new Error(
    "Access denied. This account is not an admin account.",
  );
}

      saveAuthSession(response);

      const accessToken = response.session?.accessToken;

if (!accessToken) {
  throw new Error(
    "Admin access token was not returned by the server.",
  );
}

window.localStorage.setItem(
  "asp_admin_access_token",
  accessToken,
);

      if (response.session?.refreshToken) {
        window.localStorage.setItem(
          "asp_admin_refresh_token",
          response.session.refreshToken,
        );
      }

      window.localStorage.setItem(
        "asp_admin_user",
        JSON.stringify(response.user),
      );

      window.sessionStorage.removeItem("admin_phone");

      router.replace("/admin/dashboard");
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? error.message
          : "OTP verification failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f2] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-[#0b1026]">
          Verify Admin OTP
        </h1>

        <p className="mt-2 text-gray-500">
          Enter the 6-digit OTP sent to{" "}
          <span className="font-medium text-gray-700">
            {phone || "your admin mobile number"}
          </span>
        </p>

        {message && (
          <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {message}
          </div>
        )}

        <form onSubmit={handleVerifyOtp}>
          <div className="mt-6 flex justify-between gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={
                  index === 0 ? "one-time-code" : "off"
                }
                maxLength={1}
                value={digit}
                disabled={loading}
                onChange={(event) =>
                  updateDigit(index, event.target.value)
                }
                onKeyDown={(event) =>
                  handleKeyDown(event, index)
                }
                onPaste={handlePaste}
                aria-label={`OTP digit ${index + 1}`}
                className="h-14 w-12 rounded-xl border text-center text-xl font-semibold outline-none transition focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 disabled:bg-gray-100"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join("").length !== OTP_LENGTH}
            className="mt-6 w-full rounded-xl bg-[#D4AF37] py-4 font-semibold text-black transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
      </div>
    </main>
  );
}
