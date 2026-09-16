"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000";

const ALL_CHARTS = ["D1", "D2", "D3", "D7", "D9", "D10", "D12", "D60"] as const;

type ChartCode = (typeof ALL_CHARTS)[number];

type KundliFeatures = {
  portal: string;
  includedCharts: string[];
  printReports: boolean;
  downloadPdfReports: boolean;
  saveCustomerCharts: boolean;
  detailedKundliReports: boolean;
  unlimitedKundliGeneration: boolean;
  worldwideAccess: boolean;
  advancedDashaAnalysis: boolean;
};

type KundliSettings = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  price: number;
  currency: string;
  durationDays: number;
  isActive: boolean;
  isFeatured: boolean;
  razorpayPlanConfigured: boolean;
  features: KundliFeatures;
  updatedAt: string;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: KundliSettings;
};

function readAdminToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    localStorage.getItem("asp_admin_access_token") ||
    sessionStorage.getItem("asp_admin_access_token") ||
    ""
  );
}

function Toggle({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-700 bg-white/60 p-4 text-left transition hover:border-amber-400/50"
    >
      <div>
        <div className="font-semibold text-[#10233F]">{label}</div>
        <div className="mt-1 text-sm text-[#66758A]">{description}</div>
      </div>

      <div
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-amber-400" : "bg-slate-700"
        }`}
      >
        <div
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </div>
    </button>
  );
}

export default function AdminKundliSettingsPage() {
  const [settings, setSettings] = useState<KundliSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = readAdminToken();

      if (!token) {
        throw new Error("Admin session not found. Please login again.");
      }

      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/admin/kundli-settings`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Unable to load Kundli settings.");
      }

      setSettings(result.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load Kundli settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const selectedCharts = useMemo(
    () => new Set(settings?.features.includedCharts ?? []),
    [settings?.features.includedCharts],
  );

  function patchFeature<K extends keyof KundliFeatures>(
    key: K,
    value: KundliFeatures[K],
  ) {
    setSettings((current) =>
      current
        ? {
            ...current,
            features: {
              ...current.features,
              [key]: value,
            },
          }
        : current,
    );
  }

  function toggleChart(chart: ChartCode) {
    if (!settings) {
      return;
    }

    const next = new Set(settings.features.includedCharts);

    if (next.has(chart)) {
      next.delete(chart);
    } else {
      next.add(chart);
    }

    const ordered = ALL_CHARTS.filter((item) => next.has(item));

    if (ordered.length === 0) {
      setError("At least one Vedic chart must remain enabled.");
      return;
    }

    setError("");
    patchFeature("includedCharts", ordered);
  }

  async function saveSettings() {
    if (!settings) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const token = readAdminToken();

      if (!token) {
        throw new Error("Admin session not found. Please login again.");
      }

      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/admin/kundli-settings`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            displayName: settings.displayName,
            description: settings.description,
            price: Number(settings.price),
            durationDays: Number(settings.durationDays),
            isActive: settings.isActive,
            isFeatured: settings.isFeatured,
            features: {
              includedCharts: settings.features.includedCharts,
              printReports: settings.features.printReports,
              downloadPdfReports: settings.features.downloadPdfReports,
              saveCustomerCharts: settings.features.saveCustomerCharts,
              detailedKundliReports: settings.features.detailedKundliReports,
              unlimitedKundliGeneration:
                settings.features.unlimitedKundliGeneration,
              worldwideAccess: settings.features.worldwideAccess,
              advancedDashaAnalysis: settings.features.advancedDashaAnalysis,
            },
          }),
        },
      );

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Unable to save Kundli settings.");
      }

      setSettings(result.data);
      setSuccess("Professional Kundli settings saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save Kundli settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="asp-admin-page p-8 text-white">
        <div className="mb-6 flex justify-end">
          <a
            href="/admin"
            className="asp-admin-back-btn"
          >
            Back to Dashboard
          </a>
        </div>

        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-[#DDE3EC] bg-white p-8">
            Loading professional Kundli settings...
          </div>
        </div>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="asp-admin-page p-8 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-red-900 bg-red-950/40 p-8">
            <h1 className="text-2xl font-bold">Kundli Settings</h1>
            <p className="mt-3 text-red-200">{error}</p>

            <button
              type="button"
              onClick={() => void loadSettings()}
              className="mt-6 rounded-xl bg-amber-400 px-5 py-3 font-semibold text-slate-950"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="asp-admin-page px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">
              Astro Soul Path Admin
            </div>

            <h1 className="mt-2 text-3xl font-bold">
              Professional Kundli Settings
            </h1>

            <p className="mt-2 max-w-3xl text-[#66758A]">
              Control the astrologer professional Kundli subscription and report
              capabilities used by the backend and Flutter apps.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSettings()}
            className="asp-admin-gold-btn px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-800 bg-red-950/40 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mb-6 rounded-2xl border border-emerald-800 bg-emerald-950/40 p-4 text-emerald-200">
            {success}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-[#DDE3EC] bg-white/80 p-6 lg:col-span-2">
            <h2 className="text-xl font-bold">Subscription Plan</h2>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[#66758A]">Display name</span>

                <input
                  value={settings.displayName}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      displayName: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-[#F8FAFC] px-4 py-3 outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="text-sm text-[#66758A]">Plan code</span>

                <input
                  value={settings.name}
                  disabled
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-[#F8FAFC]/70 px-4 py-3 text-[#758297]"
                />
              </label>

              <label className="block">
                <span className="text-sm text-[#66758A]">
                  Price ({settings.currency})
                </span>

                <input
                  type="number"
                  min={0}
                  step={1}
                  value={settings.price}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      price: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-[#F8FAFC] px-4 py-3 outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="text-sm text-[#66758A]">Duration (days)</span>

                <input
                  type="number"
                  min={1}
                  value={settings.durationDays}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      durationDays: Number(event.target.value),
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-[#F8FAFC] px-4 py-3 outline-none focus:border-amber-400"
                />
              </label>
            </div>

            <label className="mt-5 block">
              <span className="text-sm text-[#66758A]">Description</span>

              <textarea
                rows={4}
                value={settings.description ?? ""}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    description: event.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-700 bg-[#F8FAFC] px-4 py-3 outline-none focus:border-amber-400"
              />
            </label>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Toggle
                checked={settings.isActive}
                label="Plan active"
                description="Controls whether new purchases can use this professional Kundli plan."
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    isActive: value,
                  })
                }
              />

              <Toggle
                checked={settings.isFeatured}
                label="Featured plan"
                description="Marks this plan as featured in subscription presentation."
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    isFeatured: value,
                  })
                }
              />
            </div>
          </section>

          <section className="rounded-3xl border border-amber-400/30 bg-gradient-to-b from-amber-400/10 to-slate-900 p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-400">
              Live Plan
            </div>

            <div className="mt-4 text-4xl font-black">
              ₹{settings.price.toLocaleString("en-IN")}
            </div>

            <div className="mt-1 text-[#66758A]">
              {settings.durationDays} days
            </div>

            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-800 pb-3">
                <span className="text-[#66758A]">Portal</span>
                <span>Astrologer</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-3">
                <span className="text-[#66758A]">Status</span>
                <span>{settings.isActive ? "Active" : "Disabled"}</span>
              </div>

              <div className="flex justify-between border-b border-slate-800 pb-3">
                <span className="text-[#66758A]">Payment plan</span>
                <span>
                  {settings.razorpayPlanConfigured
                    ? "Configured"
                    : "Not configured"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#66758A]">Last updated</span>
                <span className="text-right">
                  {new Date(settings.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-[#DDE3EC] bg-white/80 p-6">
          <h2 className="text-xl font-bold">Vedic Charts</h2>

          <p className="mt-2 text-sm text-[#66758A]">
            Only selected charts are advertised as included in the professional
            plan. Astrology values still come from the verified backend
            provider.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {ALL_CHARTS.map((chart) => {
              const selected = selectedCharts.has(chart);

              return (
                <button
                  key={chart}
                  type="button"
                  onClick={() => toggleChart(chart)}
                  className={`rounded-2xl border px-4 py-4 text-center font-bold transition ${
                    selected
                      ? "border-amber-400 bg-amber-400/10 text-[#987116]"
                      : "border-slate-700 bg-[#F8FAFC] text-[#758297]"
                  }`}
                >
                  {chart}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#DDE3EC] bg-white/80 p-6">
          <h2 className="text-xl font-bold">Professional Features</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Toggle
              checked={settings.features.downloadPdfReports}
              label="PDF reports"
              description="Allow professional Kundli PDF downloads."
              onChange={(value) => patchFeature("downloadPdfReports", value)}
            />

            <Toggle
              checked={settings.features.printReports}
              label="Print reports"
              description="Expose print-ready professional Kundli reports."
              onChange={(value) => patchFeature("printReports", value)}
            />

            <Toggle
              checked={settings.features.saveCustomerCharts}
              label="Save customer charts"
              description="Allow astrologers to retain generated customer Kundlis."
              onChange={(value) => patchFeature("saveCustomerCharts", value)}
            />

            <Toggle
              checked={settings.features.detailedKundliReports}
              label="Detailed reports"
              description="Enable the complete professional Vedic report experience."
              onChange={(value) => patchFeature("detailedKundliReports", value)}
            />

            <Toggle
              checked={settings.features.unlimitedKundliGeneration}
              label="Unlimited generation"
              description="Professional plan allows unlimited eligible Kundli generation."
              onChange={(value) =>
                patchFeature("unlimitedKundliGeneration", value)
              }
            />

            <Toggle
              checked={settings.features.worldwideAccess}
              label="Worldwide access"
              description="Allow supported international birth locations."
              onChange={(value) => patchFeature("worldwideAccess", value)}
            />

            <Toggle
              checked={settings.features.advancedDashaAnalysis}
              label="Advanced Dasha analysis"
              description="Expose Mahadasha and Antardasha professional analysis."
              onChange={(value) => patchFeature("advancedDashaAnalysis", value)}
            />
          </div>
        </section>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSettings()}
            className="asp-admin-gold-btn px-7 py-3 font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Kundli Settings"}
          </button>
        </div>
      </div>
    </main>
  );
}


