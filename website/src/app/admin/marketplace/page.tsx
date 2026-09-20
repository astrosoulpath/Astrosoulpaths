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

export default function AdminMarketplacePage() {
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
    <main className="asp-admin-page px-4 py-10 sm:px-6 lg:px-8">
      <div className="asp-admin-shell">

        {/* PAGE HEADER */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="asp-admin-eyebrow">
              Admin Controlled
            </p>

            <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-[#0B1026]">
              Marketplace Sellers
            </h1>

            <p className="asp-admin-subtitle mt-3">
              Review and control astrologer marketplace seller access.
            </p>

            <a
              href="/admin/marketplace/categories"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[#D4AF37] bg-white px-5 py-3 text-sm font-extrabold text-[#9A7010] shadow-sm transition hover:bg-amber-50"
            >
              <span aria-hidden="true">▣</span>
              Manage Categories
            </a>
          </div>

          <div className="flex flex-col items-end gap-4">
            <a
              href="/admin"
              className="asp-admin-back-btn"
            >
              ← Back to Dashboard
            </a>

            <button
              type="button"
              onClick={() => void loadSellers()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B1730] px-5 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-[#14294A]"
            >
              <span className="text-lg">↻</span>
              Refresh
            </button>
          </div>
        </div>

        {/* SUMMARY */}
        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="flex items-center gap-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-2xl font-black text-[#0B1730]">
              ♙
            </div>

            <div>
              <p className="text-sm font-bold text-[#4B5C73]">
                Total sellers
              </p>
              <p className="mt-1 text-3xl font-extrabold text-[#0B1730]">
                {sellers.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-2xl border border-[#E4BF4B] bg-amber-50/60 p-6 shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl font-black text-[#A87300]">
              ◷
            </div>

            <div>
              <p className="text-sm font-bold text-[#4B5C73]">
                Pending approval
              </p>
              <p className="mt-1 text-3xl font-extrabold text-[#A87300]">
                {pendingCount}
              </p>
            </div>
          </div>
        </section>

        {/* ALERTS */}
        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700">
            {notice}
          </div>
        ) : null}

        {/* SELLERS PANEL */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

          <div className="border-b border-gray-200 bg-[#FAFBFC] px-6 py-4">
            <h2 className="text-lg font-extrabold text-[#0B1730]">
              Seller Management
            </h2>

            <p className="mt-1 text-sm text-[#65748A]">
              Marketplace seller accounts and approval status
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm font-semibold text-[#65748A]">
              Loading sellers...
            </div>
          ) : sellers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-extrabold text-[#0B1730]">
                No seller profiles found.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
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
                    className="p-6 transition hover:bg-[#FCFCFA]"
                  >
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] lg:items-center">

                      {/* SELLER */}
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl font-black text-[#9A7010]">
                          ▣
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="truncate text-lg font-extrabold text-[#0B1730]">
                              {seller.shopDisplayName || "Unnamed seller"}
                            </h3>

                            <span
                              className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                                seller.status === "ACTIVE"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : seller.status === "PENDING"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              ● {seller.status}
                            </span>
                          </div>

                          {seller.shopBio ? (
                            <p className="mt-2 max-w-xl text-sm leading-6 text-[#65748A]">
                              {seller.shopBio}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {/* ASTROLOGER */}
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wide text-[#8290A3]">
                          Astrologer
                        </p>

                        <p
                          className={`mt-2 text-sm font-extrabold ${
                            astrologerOk
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {astrologerOk ? "● Eligible" : "● Not eligible"}
                        </p>
                      </div>

                      {/* USER */}
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wide text-[#8290A3]">
                          User Status
                        </p>

                        <p
                          className={`mt-2 text-sm font-extrabold ${
                            userOk
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {userOk ? "● Active" : "● Blocked / Inactive"}
                        </p>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">

                        {(seller.status === "PENDING" ||
                          seller.status === "REJECTED") ? (
                          <button
                            type="button"
                            disabled={working || !astrologerOk || !userOk}
                            onClick={() => void activateSeller(seller.id)}
                            className="rounded-xl bg-[#E9B91F] px-5 py-2.5 text-sm font-extrabold text-[#0B1730] shadow-sm transition hover:bg-[#D9A900] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {working ? "Working..." : "Activate"}
                          </button>
                        ) : (
                          <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-emerald-700">
                            ✓ Active
                          </span>
                        )}

                        {seller.status === "PENDING" ? (
                          <button
                            type="button"
                            disabled={working}
                            onClick={() => void rejectSeller(seller.id)}
                            className="rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-extrabold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {seller.rejectionReason ? (
                      <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                        Rejection reason: {seller.rejectionReason}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}

          {/* FOOTER */}
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-[#FAFBFC] px-6 py-4 text-sm text-[#65748A] sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing <strong className="text-[#0B1730]">{sellers.length}</strong>{" "}
              seller{sellers.length === 1 ? "" : "s"}
            </span>

            <span className="rounded-lg border border-[#D4AF37] bg-amber-50 px-4 py-2 font-extrabold text-[#9A7010]">
              Page 1
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}

