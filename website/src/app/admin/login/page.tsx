"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import PhoneInput, {
  isValidPhoneNumber,
  type Value,
} from "react-phone-number-input";

import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

import { firebaseAuth } from "@/lib/firebaseClient";

export default function AdminLoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState<Value>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f2] px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-[#0b1026]">Admin Login</h1>

        <p className="mt-2 text-gray-500">
          Login with registered admin mobile number
        </p>

        {message && (
          <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {message}
          </div>
        )}

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
    </main>
  );
}
