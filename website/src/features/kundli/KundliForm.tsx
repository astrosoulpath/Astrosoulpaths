"use client";

import { useState } from "react";
import { generateKundli } from "@/services/kundliService";
import { KundliResult } from "./KundliResult";

type KundliGeneratedData = {
  id: string;
  name?: string | null;
  dob: string;
  tob: string;
  lat: number;
  lon: number;
  timezone: number;
  lang: string;
  hash: string;
  createdAt: string;
};

export function KundliForm() {
  const [form, setForm] = useState({
    name: "",
    gender: "",
    dob: "",
    tob: "",
    birthPlace: "",
    lat: "",
    lon: "",
    timezone: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<KundliGeneratedData | null>(null);

  function updateField(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleGenerate() {
    setError("");
    setResult(null);

    if (!form.name || !form.dob || !form.tob || !form.lat || !form.lon || !form.timezone) {
      setError("Please fill name, date, time, latitude, longitude and timezone.");
      return;
    }

    try {
      setLoading(true);

      const response = await generateKundli({
        name: form.name,
        dob: form.dob,
        tob: form.tob,
        lat: Number(form.lat),
        lon: Number(form.lon),
        timezone: Number(form.timezone),
        lang: "en",
      });

      setResult(response.data);
    } catch (err: any) {
      setError(err?.message || "Failed to generate Kundli.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] py-12">
      <div className="mx-auto max-w-5xl px-6">
        <div className="rounded-3xl bg-white p-8 shadow">
          <p className="font-semibold text-[#D4AF37]">Kundli Generation</p>

          <h1 className="mt-3 text-4xl font-bold text-[#0B1026]">
            Generate Personalized Kundli
          </h1>

          <p className="mt-3 text-gray-600">
            Enter birth details to generate a Vedic astrology based Kundli.
          </p>

          {error && (
            <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-600">
              {error}
            </p>
          )}

          <form className="mt-8 grid gap-5 md:grid-cols-2">
            <input
              className="rounded-xl border p-4"
              placeholder="Full Name *"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
            />

            <select
              className="rounded-xl border p-4"
              value={form.gender}
              onChange={(e) => updateField("gender", e.target.value)}
            >
              <option value="">Select Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>

            <input
              type="date"
              className="rounded-xl border p-4"
              value={form.dob}
              onChange={(e) => updateField("dob", e.target.value)}
            />

            <input
              type="time"
              className="rounded-xl border p-4"
              value={form.tob}
              onChange={(e) => updateField("tob", e.target.value)}
            />

            <input
              className="rounded-xl border p-4 md:col-span-2"
              placeholder="Birth Place e.g. Ahmedabad, Gujarat"
              value={form.birthPlace}
              onChange={(e) => updateField("birthPlace", e.target.value)}
            />

            <input
              className="rounded-xl border p-4"
              placeholder="Latitude"
              value={form.lat}
              onChange={(e) => updateField("lat", e.target.value)}
            />

            <input
              className="rounded-xl border p-4"
              placeholder="Longitude"
              value={form.lon}
              onChange={(e) => updateField("lon", e.target.value)}
            />

            <input
              className="rounded-xl border p-4"
              placeholder="Timezone e.g. 5.5"
              value={form.timezone}
              onChange={(e) => updateField("timezone", e.target.value)}
            />

            <button
              type="button"
              disabled={loading}
              onClick={handleGenerate}
              className="rounded-xl bg-[#D4AF37] py-4 font-semibold text-[#0B1026] disabled:opacity-60 md:col-span-2"
            >
              {loading ? "Generating..." : "Generate Kundli"}
            </button>
          </form>

          {result && <KundliResult result={result} />}
        </div>
      </div>
    </main>
  );
}