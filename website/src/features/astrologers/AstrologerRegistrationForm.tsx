"use client";

import { useState } from "react";
import { registerAstrologer } from "@/services/astrologerService";

export function AstrologerRegistrationForm() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    gender: "",
    languages: "",
    expertise: "",
    experienceYears: "",
    consultationPrice: "",
    bio: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (
      !form.fullName ||
      !form.email ||
      !form.phoneNumber ||
      !form.gender ||
      !form.languages ||
      !form.expertise ||
      !form.experienceYears ||
      !form.consultationPrice
    ) {
      setError("Please fill all required fields.");
      return;
    }

    try {
      setLoading(true);

      await registerAstrologer({
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        gender: form.gender,
        languages: form.languages.split(",").map((item) => item.trim()),
        expertise: form.expertise.split(",").map((item) => item.trim()),
        experienceYears: Number(form.experienceYears),
        consultationPrice: Number(form.consultationPrice),
        bio: form.bio,
      });

      setMessage(
        "Registration submitted successfully. Admin approval is required before your profile goes live."
      );
    } catch (err: any) {
      setError(err?.message || "Astrologer registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <p className="font-semibold text-[#D4AF37]">
            Astrologer Registration
          </p>

          <h1 className="mt-3 text-4xl font-bold text-[#0B1026]">
            Join Astro Soul Path as an Astrologer
          </h1>

          <p className="mt-3 text-[#374151]">
            Submit your details for admin review. Once approved, your profile
            will appear in the astrologer marketplace.
          </p>

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-red-600">
              {error}
            </p>
          )}

          {message && (
            <p className="mt-5 rounded-xl bg-green-50 p-3 text-green-700">
              {message}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
            <input
              placeholder="Full Name *"
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              className="rounded-xl border p-4"
            />

            <input
              type="email"
              placeholder="Email *"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="rounded-xl border p-4"
            />

            <input
              placeholder="Phone Number (+91...) *"
              value={form.phoneNumber}
              onChange={(e) => updateField("phoneNumber", e.target.value)}
              className="rounded-xl border p-4"
            />

            <select
              value={form.gender}
              onChange={(e) => updateField("gender", e.target.value)}
              className="rounded-xl border p-4"
            >
              <option value="">Select Gender *</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>

            <input
              placeholder="Languages e.g. Hindi, English *"
              value={form.languages}
              onChange={(e) => updateField("languages", e.target.value)}
              className="rounded-xl border p-4"
            />

            <input
              placeholder="Expertise e.g. Vedic, Tarot, Numerology *"
              value={form.expertise}
              onChange={(e) => updateField("expertise", e.target.value)}
              className="rounded-xl border p-4"
            />

            <input
              type="number"
              placeholder="Years of Experience *"
              value={form.experienceYears}
              onChange={(e) => updateField("experienceYears", e.target.value)}
              className="rounded-xl border p-4"
            />

            <input
              type="number"
              placeholder="Consultation Price per minute ₹ *"
              value={form.consultationPrice}
              onChange={(e) => updateField("consultationPrice", e.target.value)}
              className="rounded-xl border p-4"
            />

            <textarea
              placeholder="Short Bio"
              value={form.bio}
              onChange={(e) => updateField("bio", e.target.value)}
              className="min-h-32 rounded-xl border p-4 md:col-span-2"
            />

            <button
              disabled={loading}
              className="rounded-xl bg-[#D4AF37] py-4 font-semibold text-[#0B1026] disabled:opacity-60 md:col-span-2"
            >
              {loading ? "Submitting..." : "Submit for Admin Approval"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}