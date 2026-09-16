"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AstrologerRegistrationForm } from "@/features/astrologers/AstrologerRegistrationForm";

export default function AstrologerRegisterPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const token =
      localStorage.getItem("asp_access_token") ??
      localStorage.getItem("access_token");

    if (!token) {
      localStorage.setItem(
        "asp_post_login_redirect",
        "/astrologer/register",
      );

      router.replace("/login");
      return;
    }

    setAuthChecked(true);
  }, [router]);

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#FAF7F0] px-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-[#0B1026]">
            Preparing Registration
          </h1>

          <p className="mt-3 text-gray-600">
            Please wait while we verify your login session.
          </p>

          <div className="mx-auto mt-6 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#D4AF37]" />
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0]">
      <AstrologerRegistrationForm />
    </div>
  );
}