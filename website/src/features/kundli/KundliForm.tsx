"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import { KundliResult } from "./KundliResult";
import {
  generateKundli,
  type KundliGeneratedData,
} from "@/services/kundliService";

type KundliFormState = {
  name: string;
  gender: string;
  dob: string;
  tob: string;
  birthPlace: string;
  lat: string;
  lon: string;
  timezone: string;
  language: string;
};

const initialForm: KundliFormState = {
  name: "",
  gender: "",
  dob: "",
  tob: "",
  birthPlace: "",
  lat: "",
  lon: "",
  timezone: "5.5",
  language: "en",
};

function isValidLatitude(value: number) {
  return (
    Number.isFinite(value) &&
    value >= -90 &&
    value <= 90
  );
}

function isValidLongitude(value: number) {
  return (
    Number.isFinite(value) &&
    value >= -180 &&
    value <= 180
  );
}

function isValidTimezone(value: number) {
  return (
    Number.isFinite(value) &&
    value >= -12 &&
    value <= 14
  );
}

export function KundliForm() {
  const [form, setForm] =
    useState<KundliFormState>(initialForm);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] =
    useState<KundliGeneratedData | null>(null);

  const today = useMemo(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  function updateField(
    name: keyof KundliFormState,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setError("");
  }

  function handleIndianTimezone() {
    updateField("timezone", "5.5");
  }

  function validateForm(): string | null {
    const name = form.name.trim();
    const birthPlace = form.birthPlace.trim();

    if (!name) {
      return "Please enter your full name.";
    }

    if (name.length < 2) {
      return "Please enter a valid full name.";
    }

    if (!form.gender) {
      return "Please select gender.";
    }

    if (!form.dob) {
      return "Please select date of birth.";
    }

    if (form.dob > today) {
      return "Date of birth cannot be in the future.";
    }

    if (!form.tob) {
      return "Please enter exact time of birth.";
    }

    if (!birthPlace) {
      return "Please enter place of birth.";
    }

    const latitude = Number(form.lat);
    const longitude = Number(form.lon);
    const timezone = Number(form.timezone);

    if (
      !form.lat.trim() ||
      !isValidLatitude(latitude)
    ) {
      return "Latitude must be between -90 and 90.";
    }

    if (
      !form.lon.trim() ||
      !isValidLongitude(longitude)
    ) {
      return "Longitude must be between -180 and 180.";
    }

    if (
      !form.timezone.trim() ||
      !isValidTimezone(timezone)
    ) {
      return "Timezone must be between -12 and +14.";
    }

    return null;
  }

  async function handleGenerate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setResult(null);

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);

      const response = await generateKundli({
        name: form.name.trim(),
        gender: form.gender,
        birthPlace: form.birthPlace.trim(),
        dob: form.dob,
        tob: form.tob,
        lat: Number(form.lat),
        lon: Number(form.lon),
        timezone: Number(form.timezone),
        lang: form.language,
      });

      if (!response?.data?.id) {
        throw new Error(
          "The Kundli API returned an invalid response.",
        );
      }

      setResult(response.data);

      window.setTimeout(() => {
        document
          .getElementById("kundli-result")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate Kundli. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(initialForm);
    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl bg-white p-6 shadow-lg sm:p-8 lg:p-10">
          <div className="max-w-3xl">
            <p className="font-semibold text-[#D4AF37]">
              Free Vedic Kundli
            </p>

            <h1 className="mt-3 text-4xl font-bold leading-tight text-[#0B1026] sm:text-5xl">
              Generate your personalized Kundli
            </h1>

            <p className="mt-4 leading-7 text-gray-600">
              Enter accurate birth details to generate your
              Vedic Kundli. Exact birth time and location are
              important for accurate planetary calculations.
            </p>
          </div>

          <div className="mt-8 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5">
            <p className="font-semibold text-[#0B1026]">
              Before you begin
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-600">
              Use the exact birth date, time and location from
              the birth record whenever possible. For locations
              in India, the timezone is usually +5.5.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
            >
              <p className="font-semibold">
                Unable to generate Kundli
              </p>

              <p className="mt-1 text-sm">{error}</p>
            </div>
          )}

          <form
            onSubmit={handleGenerate}
            className="mt-8 grid gap-6 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="kundli-name"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Full name *
              </label>

              <input
                id="kundli-name"
                type="text"
                autoComplete="name"
                value={form.name}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "name",
                    event.target.value,
                  )
                }
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-gray-300 px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="kundli-gender"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Gender *
              </label>

              <select
                id="kundli-gender"
                value={form.gender}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "gender",
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
              >
                <option value="">
                  Select gender
                </option>

                <option value="MALE">
                  Male
                </option>

                <option value="FEMALE">
                  Female
                </option>

                <option value="OTHER">
                  Prefer not to specify
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="kundli-dob"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Date of birth *
              </label>

              <input
                id="kundli-dob"
                type="date"
                max={today}
                value={form.dob}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "dob",
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="kundli-tob"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Exact time of birth *
              </label>

              <input
                id="kundli-tob"
                type="time"
                step={60}
                value={form.tob}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "tob",
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-gray-300 px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="kundli-birth-place"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Place of birth *
              </label>

              <input
                id="kundli-birth-place"
                type="text"
                value={form.birthPlace}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "birthPlace",
                    event.target.value,
                  )
                }
                placeholder="For example: Ahmedabad, Gujarat, India"
                className="w-full rounded-xl border border-gray-300 px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
              />

              <p className="mt-2 text-xs text-gray-500">
                Automatic place search and coordinates will be
                connected with the Geo API.
              </p>
            </div>

            <div>
              <label
                htmlFor="kundli-latitude"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Latitude *
              </label>

              <input
                id="kundli-latitude"
                type="number"
                min={-90}
                max={90}
                step="any"
                inputMode="decimal"
                value={form.lat}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "lat",
                    event.target.value,
                  )
                }
                placeholder="For example: 23.0225"
                className="w-full rounded-xl border border-gray-300 px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="kundli-longitude"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Longitude *
              </label>

              <input
                id="kundli-longitude"
                type="number"
                min={-180}
                max={180}
                step="any"
                inputMode="decimal"
                value={form.lon}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "lon",
                    event.target.value,
                  )
                }
                placeholder="For example: 72.5714"
                className="w-full rounded-xl border border-gray-300 px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
              />
            </div>

            <div>
              <label
                htmlFor="kundli-timezone"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Timezone *
              </label>

              <div className="flex gap-3">
                <input
                  id="kundli-timezone"
                  type="number"
                  min={-12}
                  max={14}
                  step="0.25"
                  inputMode="decimal"
                  value={form.timezone}
                  disabled={loading}
                  onChange={(event) =>
                    updateField(
                      "timezone",
                      event.target.value,
                    )
                  }
                  placeholder="For example: 5.5"
                  className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
                />

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleIndianTimezone}
                  className="rounded-xl border border-[#D4AF37] px-4 py-3 text-sm font-semibold text-[#0B1026] transition hover:bg-[#D4AF37]/10 disabled:opacity-50"
                >
                  India +5.5
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="kundli-language"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Report language
              </label>

              <select
                id="kundli-language"
                value={form.language}
                disabled={loading}
                onChange={(event) =>
                  updateField(
                    "language",
                    event.target.value,
                  )
                }
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-4 outline-none transition focus:border-[#D4AF37] disabled:bg-gray-100"
              >
                <option value="en">
                  English
                </option>

                <option value="hi">
                  Hindi
                </option>
              </select>
            </div>

            <div className="flex flex-col-reverse gap-3 md:col-span-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={loading}
                onClick={handleReset}
                className="rounded-xl border border-[#0B1026] px-7 py-4 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset
              </button>

              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[#D4AF37] px-8 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Generating Kundli..."
                  : "Generate Kundli"}
              </button>
            </div>
          </form>
        </div>

        {loading && (
          <div className="mt-8 rounded-3xl bg-white p-8 shadow-lg">
            <div className="animate-pulse">
              <div className="h-6 w-48 rounded bg-gray-200" />
              <div className="mt-5 h-4 w-full rounded bg-gray-200" />
              <div className="mt-3 h-4 w-4/5 rounded bg-gray-200" />

              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({
                  length: 4,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="h-28 rounded-2xl bg-gray-200"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {result && (
          <div
            id="kundli-result"
            className="scroll-mt-28"
          >
            <KundliResult result={result} />
          </div>
        )}
      </div>
    </main>
  );
}