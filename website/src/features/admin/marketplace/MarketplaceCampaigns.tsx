"use client";

import { refreshAdminSession } from "@/features/admin/auth/admin-session";

import { getAdminApiBase } from "@/features/admin/auth/admin-contract";

import { useCallback, useEffect, useState } from "react";

type CampaignProduct = {
  id: string;
  productId: string;
  product?: {
    id: string;
    name?: string;
    status?: string;
  };
};

type Campaign = {
  id: string;
  name: string;
  festivalKey?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  bannerImageUrl?: string | null;
  discountType: "PERCENTAGE" | "FLAT";
  discountValue: string | number;
  maxDiscount?: string | number | null;
  startAt: string;
  endAt: string;
  priority: number;
  status: string;
  isActive: boolean;
  products?: CampaignProduct[];
};

const API = getAdminApiBase();

async function getToken() {
  return refreshAdminSession();
}

export default function MarketplaceCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const accessToken = await getToken();

    if (!accessToken) {
      setError("Admin session not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/admin/marketplace/campaigns`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message || "Failed to load campaigns.");
      }

      setCampaigns(Array.isArray(body?.data) ? body.data : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load campaigns.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function controlCampaign(
    id: string,
    action: "activate" | "pause" | "cancel",
  ) {
    const accessToken = await getToken();

    if (!accessToken) {
      setError("Admin session not found.");
      return;
    }

    if (
      action === "cancel" &&
      !window.confirm("Cancel this marketplace campaign?")
    ) {
      return;
    }

    setWorking(id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/admin/marketplace/campaigns/${id}/${action}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message || `Campaign ${action} failed.`);
      }

      setMessage(`Campaign ${action} successful.`);
      await load();
    } catch (controlError) {
      setError(
        controlError instanceof Error
          ? controlError.message
          : "Campaign control failed.",
      );
    } finally {
      setWorking("");
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-yellow-500/20 bg-black/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-[#8A6818]">
              Festival & Campaign Management
            </h3>
            <p className="mt-1 text-sm text-[#52627A]">
              Admin-controlled marketplace campaigns from the real backend.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-yellow-500/40 px-4 py-2 text-sm font-semibold text-[#8A6818]"
          >
            Refresh
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-[#52627A]">
          Loading campaigns...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
          <p className="font-semibold text-[#14243D]">No campaigns yet</p>
          <p className="mt-2 text-sm text-[#52627A]">
            No fake festival or promotional campaign has been created.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <article
              key={campaign.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-5"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-bold text-[#14243D]">
                      {campaign.title}
                    </h4>
                    <span className="rounded-full border border-yellow-500/30 px-3 py-1 text-xs font-semibold text-[#8A6818]">
                      {campaign.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-[#52627A]">
                    {campaign.name}
                    {campaign.festivalKey ? ` | ${campaign.festivalKey}` : ""}
                  </p>
                </div>

                <div className="text-right text-sm">
                  <p className="font-semibold text-[#8A6818]">
                    {campaign.discountType} {String(campaign.discountValue)}
                  </p>
                  <p className="text-[#52627A]">
                    Products: {campaign.products?.length ?? 0}
                  </p>
                </div>
              </div>

              {campaign.subtitle ? (
                <p className="mt-4 text-sm text-[#14243D]">
                  {campaign.subtitle}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 text-sm text-[#52627A] md:grid-cols-2">
                <div>Start: {new Date(campaign.startAt).toLocaleString()}</div>
                <div>End: {new Date(campaign.endAt).toLocaleString()}</div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {campaign.status !== "ACTIVE" &&
                campaign.status !== "CANCELLED" &&
                campaign.status !== "ENDED" ? (
                  <button
                    type="button"
                    disabled={working === campaign.id}
                    onClick={() =>
                      void controlCampaign(campaign.id, "activate")
                    }
                    className="rounded-xl border border-green-500/40 px-4 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                  >
                    Activate / Schedule
                  </button>
                ) : null}

                {campaign.status === "ACTIVE" ||
                campaign.status === "SCHEDULED" ? (
                  <button
                    type="button"
                    disabled={working === campaign.id}
                    onClick={() => void controlCampaign(campaign.id, "pause")}
                    className="rounded-xl border border-orange-500/40 px-4 py-2 text-sm font-semibold text-orange-300 disabled:opacity-50"
                  >
                    Pause
                  </button>
                ) : null}

                {campaign.status !== "CANCELLED" &&
                campaign.status !== "ENDED" ? (
                  <button
                    type="button"
                    disabled={working === campaign.id}
                    onClick={() => void controlCampaign(campaign.id, "cancel")}
                    className="rounded-xl border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
