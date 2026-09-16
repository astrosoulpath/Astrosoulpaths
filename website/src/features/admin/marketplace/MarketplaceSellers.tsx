"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type SellerStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REJECTED";

type MarketplaceSeller = {
  id: string;
  status: SellerStatus;
  shopDisplayName?: string | null;
  shopBio?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  astrologer?: {
    id?: string;
    isApproved?: boolean;
    isVerified?: boolean;
    user?: {
      isActive?: boolean;
      isBlocked?: boolean;
      name?: string | null;
      phone?: string | null;
      email?: string | null;
    };
  };
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string | string[];
  error?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://127.0.0.1:4000";

function getAccessToken() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("asp_admin_access_token") ??
    window.sessionStorage.getItem("asp_admin_access_token") ??
    window.localStorage.getItem("access_token") ??
    ""
  ).trim();
}

function errorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") {
    return fallback;
  }

  const source = body as Record<string, unknown>;
  const message = source.message;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  if (Array.isArray(message) && message.length > 0) {
    return message.map(String).join(", ");
  }

  if (typeof source.error === "string" && source.error.trim()) {
    return source.error.trim();
  }

  return fallback;
}

export function MarketplaceSellers() {
  const [sellers, setSellers] = useState<MarketplaceSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const pendingCount = useMemo(
    () => sellers.filter((seller) => seller.status === "PENDING").length,
    [sellers],
  );

  const loadSellers = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setLoading(false);
      setError("Admin session missing. Please login again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/marketplace/sellers`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const body = (await response.json().catch(() => null)) as ApiEnvelope<
        MarketplaceSeller[]
      > | null;

      if (!response.ok) {
        throw new Error(
          errorMessage(body, "Unable to load marketplace sellers."),
        );
      }

      setSellers(Array.isArray(body?.data) ? body.data : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load marketplace sellers.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSellers();
  }, [loadSellers]);

  async function activateSeller(id: string) {
    const token = getAccessToken();

    if (!token) {
      setError("Admin session missing. Please login again.");
      return;
    }

    setWorkingId(id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/marketplace/sellers/${id}/activate`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const body = (await response
        .json()
        .catch(() => null)) as ApiEnvelope<unknown> | null;

      if (!response.ok) {
        throw new Error(errorMessage(body, "Seller activation failed."));
      }

      setNotice("Seller activated successfully.");
      await loadSellers();
    } catch (activateError) {
      setError(
        activateError instanceof Error
          ? activateError.message
          : "Seller activation failed.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function suspendSeller(id: string) {
    const reason =
      window.prompt("Enter suspension reason (optional):")?.trim() || "";

    const token = getAccessToken();

    if (!token) {
      setError("Admin session missing. Please login again.");
      return;
    }

    setWorkingId(id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/marketplace/sellers/${id}/suspend`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            ...(reason ? { reason } : {}),
          }),
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(errorMessage(body, "Seller suspension failed."));
      }

      setNotice("Seller suspended successfully.");
      await loadSellers();
    } catch (suspendError) {
      setError(
        suspendError instanceof Error
          ? suspendError.message
          : "Seller suspension failed.",
      );
    } finally {
      setWorkingId(null);
    }
  }
  async function rejectSeller(id: string) {
    const reason = window.prompt("Enter rejection reason:");

    if (!reason?.trim()) {
      return;
    }

    const token = getAccessToken();

    if (!token) {
      setError("Admin session missing. Please login again.");
      return;
    }

    setWorkingId(id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/marketplace/sellers/${id}/reject`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason: reason.trim(),
          }),
        },
      );

      const body = (await response
        .json()
        .catch(() => null)) as ApiEnvelope<unknown> | null;

      if (!response.ok) {
        throw new Error(errorMessage(body, "Seller rejection failed."));
      }

      setNotice("Seller rejected.");
      await loadSellers();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "Seller rejection failed.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-yellow-400">
              Admin Controlled
            </p>
            <h1 className="text-3xl font-bold">Marketplace Sellers</h1>

            <a
              href="/admin/marketplace/categories"
              className="mt-3 inline-flex rounded-lg border border-yellow-500 px-3 py-2 text-xs font-semibold text-yellow-400 hover:bg-yellow-500/10"
            >
              Manage Categories
            </a>
            <p className="mt-2 text-sm text-zinc-400">
              Review and control astrologer marketplace seller access.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSellers()}
            className="rounded-xl border border-yellow-500/40 bg-zinc-900 px-4 py-3 text-sm font-semibold text-yellow-300 hover:bg-zinc-800"
          >
            Refresh
          </button>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-sm text-zinc-500">Total sellers</p>
            <p className="mt-2 text-3xl font-bold">{sellers.length}</p>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-zinc-950 p-5">
            <p className="text-sm text-zinc-500">Pending approval</p>
            <p className="mt-2 text-3xl font-bold text-yellow-400">
              {pendingCount}
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
            {notice}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-zinc-400">
            Loading sellers...
          </div>
        ) : sellers.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
            <p className="font-semibold">No seller profiles found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sellers.map((seller) => {
              const working = workingId === seller.id;
              const astrologerOk =
                seller.astrologer?.isApproved === true &&
                seller.astrologer?.isVerified === true;

              const userOk =
                seller.astrologer?.user?.isActive !== false &&
                seller.astrologer?.user?.isBlocked !== true;

              return (
                <article
                  key={seller.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-xl font-bold">
                          {seller.shopDisplayName || "Unnamed seller"}
                        </h2>

                        <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300">
                          {seller.status}
                        </span>
                      </div>

                      {seller.shopBio ? (
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
                          {seller.shopBio}
                        </p>
                      ) : null}

                      <div className="mt-4 grid gap-2 text-sm text-zinc-400 sm:grid-cols-2">
                        <p>
                          Astrologer eligibility:{" "}
                          <span
                            className={
                              astrologerOk ? "text-emerald-400" : "text-red-400"
                            }
                          >
                            {astrologerOk ? "Eligible" : "Not eligible"}
                          </span>
                        </p>

                        <p>
                          User status:{" "}
                          <span
                            className={
                              userOk ? "text-emerald-400" : "text-red-400"
                            }
                          >
                            {userOk ? "Active" : "Blocked/Inactive"}
                          </span>
                        </p>
                      </div>

                      {seller.rejectionReason ? (
                        <p className="mt-3 text-sm text-red-300">
                          Rejection reason: {seller.rejectionReason}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-3">
                      {seller.status === "PENDING" ||
                      seller.status === "REJECTED" ? (
                        <button
                          type="button"
                          disabled={working || !astrologerOk || !userOk}
                          onClick={() => void activateSeller(seller.id)}
                          className="rounded-xl bg-yellow-400 px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {working ? "Working..." : "Activate"}
                        </button>
                      ) : null}

                      {seller.status === "ACTIVE" ? (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => void suspendSeller(seller.id)}
                          className="rounded-xl border border-orange-500/50 px-5 py-3 text-sm font-semibold text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {working ? "Working..." : "Suspend"}
                        </button>
                      ) : null}
                      {seller.status === "PENDING" ? (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => void rejectSeller(seller.id)}
                          className="rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-300 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
