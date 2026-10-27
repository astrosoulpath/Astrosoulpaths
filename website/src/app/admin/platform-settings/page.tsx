"use client";

import { adminFetch } from "@/features/admin/auth/admin-session";
import Link from "next/link";
import { useEffect, useState } from "react";


type PlatformSettingsResponse = {
  success: boolean;
  message?: string;
  data: {
    platformCommissionPercent: number;
    astrologerSharePercent: number;
  };
};

export default function PlatformSettingsPage() {
  const [commission, setCommission] = useState(30);
  const [astrologerShare, setAstrologerShare] = useState(70);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await adminFetch(
          "/admin/platform-settings",
          {
            credentials: "same-origin",
            cache: "no-store",
          },
        );

        const result = (await response.json()) as PlatformSettingsResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Unable to load platform settings.",
          );
        }

        setCommission(result.data.platformCommissionPercent);
        setAstrologerShare(result.data.astrologerSharePercent);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load settings.",
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  async function save() {
    try {
      setSaving(true);
      setMessage(null);
      setError(null);

      if (commission < 0 || commission > 100) {
        throw new Error("Commission must be between 0 and 100.");
      }

      const response = await adminFetch("/admin/platform-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platformCommissionPercent: commission,
        }),
      });

      const result = (await response.json()) as PlatformSettingsResponse;

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to update platform settings.",
        );
      }

      setCommission(result.data.platformCommissionPercent);
      setAstrologerShare(result.data.astrologerSharePercent);
      setMessage("Platform commission updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="asp-admin-page px-6 py-8 text-[#14243D]">
        <Link href="/admin/content/about" className="inline-flex min-h-12 items-center underline mb-5">Content Management · About Us</Link>
        <div className="mb-6 flex justify-end">
          <a
            href="/admin"
            className="asp-admin-back-btn"
          >
            Back to Dashboard
          </a>
        </div>

      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#8A6818]">
              Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold">Platform Settings</h1>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-[#DDE3EC] px-4 py-2"
          >
            Back
          </Link>
        </div>

        <section className="rounded-2xl border border-[#DDE3EC] bg-white/5 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-[#F8FAFC] p-5">
              <p className="text-[#66758A]">Platform Commission</p>
              <p className="mt-2 text-3xl font-bold text-[#8A6818]">
                {loading ? "..." : `${commission}%`}
              </p>
            </div>

            <div className="rounded-xl bg-[#F8FAFC] p-5">
              <p className="text-[#66758A]">Astrologer Share</p>
              <p className="mt-2 text-3xl font-bold text-emerald-700">
                {loading ? "..." : `${astrologerShare}%`}
              </p>
            </div>
          </div>

          <div className="mt-6 flex max-w-md gap-3">
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={commission}
              onChange={(event) => {
                const value = Number(event.target.value);
                setCommission(value);
                setAstrologerShare(Number((100 - value).toFixed(2)));
              }}
              className="w-full rounded-xl border border-[#DDE3EC] bg-white px-4 py-3"
            />

            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || loading}
              className="asp-admin-gold-btn px-5 py-3 font-bold text-black disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>

          {message ? <p className="mt-4 text-emerald-700">{message}</p> : null}

          {error ? <p className="mt-4 text-red-700">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}


