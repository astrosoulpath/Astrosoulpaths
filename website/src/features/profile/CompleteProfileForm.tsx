"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveAstroProfile } from "@/services/profileService";

export function CompleteProfileForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    fullname: "",
    gender: "",
    maritalStatus: "",
    occupation: "",
    dob: "",
    tob: "",
    city: "",
    state: "",
    country: "India",
    countryCode: "IN",
    lat: "",
    lon: "",
    timezone: "5.5",
    timezoneName: "Asia/Kolkata",
    lang: "en",
    avatarUrl: "",
  });

  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!form.name || !form.dob || !form.tob || !form.lat || !form.lon || !form.timezone) {
      setError("Name, birth date, birth time, latitude, longitude and timezone are required.");
      return;
    }

    try {
      setLoading(true);

      await saveAstroProfile({
        name: form.name,
        fullname: form.fullname || form.name,
        gender: form.gender ? (form.gender as "MALE" | "FEMALE" | "OTHER") : undefined,
        maritalStatus: form.maritalStatus || undefined,
        occupation: form.occupation || undefined,
        dob: form.dob,
        tob: form.tob,
        lat: Number(form.lat),
        lon: Number(form.lon),
        timezone: Number(form.timezone),
        timezoneName: form.timezoneName || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        country: form.country || undefined,
        countryCode: form.countryCode || undefined,
        lang: form.lang || "en",
        avatarUrl: form.avatarUrl || undefined,
      });

      router.push("/");
    } catch (err: any) {
      setError(err?.message || "Profile save failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="rounded-3xl bg-white p-8 shadow-lg">
          <p className="font-semibold text-[#D4AF37]">Step 2 of 5</p>

          <h1 className="mt-3 text-4xl font-bold text-[#0B1026]">
            Complete Your Birth Profile
          </h1>

          <p className="mt-3 text-[#374151]">
            These details are required for Kundli, horoscope, matchmaking,
            dosha, dasha and personalized astrology guidance.
          </p>

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-3 text-red-600">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block font-semibold text-[#0B1026]">
                Profile Photo
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-gray-300 p-4"
              />
              {profilePhoto && (
                <p className="mt-2 text-sm text-[#374151]">
                  Selected: {profilePhoto.name}
                </p>
              )}
            </div>

            <input placeholder="Display Name *" value={form.name} onChange={(e) => updateField("name", e.target.value)} className="rounded-xl border p-4" />
            <input placeholder="Full Legal Name" value={form.fullname} onChange={(e) => updateField("fullname", e.target.value)} className="rounded-xl border p-4" />

            <select value={form.gender} onChange={(e) => updateField("gender", e.target.value)} className="rounded-xl border p-4">
              <option value="">Select Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>

            <select value={form.maritalStatus} onChange={(e) => updateField("maritalStatus", e.target.value)} className="rounded-xl border p-4">
              <option value="">Marital Status</option>
              <option value="SINGLE">Single</option>
              <option value="MARRIED">Married</option>
              <option value="DIVORCED">Divorced</option>
              <option value="WIDOWED">Widowed</option>
            </select>

            <input placeholder="Occupation" value={form.occupation} onChange={(e) => updateField("occupation", e.target.value)} className="rounded-xl border p-4" />
            <input type="date" value={form.dob} onChange={(e) => updateField("dob", e.target.value)} className="rounded-xl border p-4" />
            <input type="time" value={form.tob} onChange={(e) => updateField("tob", e.target.value)} className="rounded-xl border p-4" />

            <input placeholder="Birth City" value={form.city} onChange={(e) => updateField("city", e.target.value)} className="rounded-xl border p-4" />
            <input placeholder="Birth State" value={form.state} onChange={(e) => updateField("state", e.target.value)} className="rounded-xl border p-4" />
            <input placeholder="Birth Country" value={form.country} onChange={(e) => updateField("country", e.target.value)} className="rounded-xl border p-4" />
            <input placeholder="Country Code e.g. IN" value={form.countryCode} onChange={(e) => updateField("countryCode", e.target.value)} className="rounded-xl border p-4" />

            <input placeholder="Latitude *" value={form.lat} onChange={(e) => updateField("lat", e.target.value)} className="rounded-xl border p-4" />
            <input placeholder="Longitude *" value={form.lon} onChange={(e) => updateField("lon", e.target.value)} className="rounded-xl border p-4" />
            <input placeholder="Timezone e.g. 5.5 *" value={form.timezone} onChange={(e) => updateField("timezone", e.target.value)} className="rounded-xl border p-4" />
            <input placeholder="Timezone Name" value={form.timezoneName} onChange={(e) => updateField("timezoneName", e.target.value)} className="rounded-xl border p-4" />

            <button
              disabled={loading}
              className="rounded-xl bg-[#D4AF37] py-4 font-semibold text-[#0B1026] disabled:opacity-60 md:col-span-2"
            >
              {loading ? "Saving Profile..." : "Save & Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}