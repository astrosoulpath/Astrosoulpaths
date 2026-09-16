"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type FeedbackStatus = "NEW" | "REVIEWED" | "RESOLVED";

type FeedbackCategory =
  | "GENERAL"
  | "APP_EXPERIENCE"
  | "ASTROLOGY_CONTENT"
  | "PAYMENT"
  | "CONSULTATION"
  | "TECHNICAL"
  | "SUGGESTION"
  | "OTHER";

type FeedbackCustomer = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

type FeedbackItem = {
  id: string;
  customerId: string;
  category: FeedbackCategory;
  rating?: number | null;
  message: string;
  status: FeedbackStatus;
  adminNote?: string | null;
  reviewedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: FeedbackCustomer | null;
};

type FeedbackListResponse = {
  success: boolean;
  message?: string;
  data?: {
    items?: FeedbackItem[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
};

type FeedbackDetailResponse = {
  success: boolean;
  message?: string;
  data?: FeedbackItem;
};

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("asp_admin_access_token") ??
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

function statusClasses(status: FeedbackStatus) {
  switch (status) {
    case "RESOLVED":
      return "border-green-200 bg-green-50 text-green-700";
    case "REVIEWED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function categoryLabel(category: FeedbackCategory) {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | FeedbackStatus>(
    "ALL",
  );

  const [categoryFilter, setCategoryFilter] = useState<
    "ALL" | FeedbackCategory
  >("ALL");

  const [search, setSearch] = useState("");
  const [adminNote, setAdminNote] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadFeedback = useCallback(
    async (showRefresh = false) => {
      try {
        showRefresh ? setIsRefreshing(true) : setIsLoading(true);
        setErrorMessage(null);

        const token = getAccessToken();

        if (!token) {
          throw new Error("Admin login token is missing. Please log in again.");
        }

        const query = new URLSearchParams({
          page: "1",
          limit: "100",
        });

        if (statusFilter !== "ALL") {
          query.set("status", statusFilter);
        }

        if (categoryFilter !== "ALL") {
          query.set("category", categoryFilter);
        }

        const response = await fetch(
          `${API_BASE_URL.replace(/\/+$/, "")}/admin/feedback?${query.toString()}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          },
        );

        const data = (await readJson(response)) as FeedbackListResponse | null;

        if (!response.ok) {
          const rawMessage = data?.message;

          throw new Error(
            typeof rawMessage === "string"
              ? rawMessage
              : `Unable to load feedback (${response.status}).`,
          );
        }

        setItems(Array.isArray(data?.data?.items) ? data!.data!.items! : []);
      } catch (error) {
        setItems([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [statusFilter, categoryFilter],
  );

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const filteredItems = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      const customerName = item.customer?.name?.toLowerCase() ?? "";
      const customerEmail = item.customer?.email?.toLowerCase() ?? "";
      const customerPhone = item.customer?.phone?.toLowerCase() ?? "";

      return (
        item.message.toLowerCase().includes(normalized) ||
        item.category.toLowerCase().includes(normalized) ||
        customerName.includes(normalized) ||
        customerEmail.includes(normalized) ||
        customerPhone.includes(normalized)
      );
    });
  }, [items, search]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      newCount: items.filter((item) => item.status === "NEW").length,
      reviewed: items.filter((item) => item.status === "REVIEWED").length,
      resolved: items.filter((item) => item.status === "RESOLVED").length,
    };
  }, [items]);

  async function openDetail(id: string) {
    try {
      setErrorMessage(null);

      const token = getAccessToken();

      if (!token) {
        throw new Error("Admin login token is missing.");
      }

      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/admin/feedback/${encodeURIComponent(id)}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const data = (await readJson(response)) as FeedbackDetailResponse | null;

      if (!response.ok || !data?.data) {
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : `Unable to load feedback (${response.status}).`,
        );
      }

      setSelected(data.data);
      setAdminNote(data.data.adminNote ?? "");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  }

  async function updateStatus(status: FeedbackStatus) {
    if (!selected) {
      return;
    }

    try {
      setIsUpdating(true);
      setErrorMessage(null);

      const token = getAccessToken();

      if (!token) {
        throw new Error("Admin login token is missing.");
      }

      const response = await fetch(
        `${API_BASE_URL.replace(/\/+$/, "")}/admin/feedback/${encodeURIComponent(
          selected.id,
        )}/status`,
        {
          method: "PATCH",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            adminNote: adminNote.trim() || undefined,
          }),
        },
      );

      const data = (await readJson(response)) as FeedbackDetailResponse | null;

      if (!response.ok || !data?.data) {
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : `Unable to update feedback (${response.status}).`,
        );
      }

      setSelected(data.data);

      setItems((current) =>
        current.map((item) => (item.id === data.data!.id ? data.data! : item)),
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <main className="asp-admin-page px-4 py-8 text-gray-900 sm:px-6 lg:px-8">
      <div className="asp-admin-shell">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="asp-admin-eyebrow">
              Admin Panel
            </p>

            <h1 className="mt-2 text-4xl font-extrabold text-[#0B1026]">
              Customer Feedback
            </h1>

            <p className="mt-3 max-w-3xl text-[#4B5C73]">
              Review real customer feedback and manage its status.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="asp-admin-back-btn"
            >
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() => void loadFeedback(true)}
              disabled={isRefreshing}
              className="rounded-xl bg-[#0B1026] px-5 py-3 font-bold text-white disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total Feedback", stats.total],
            ["New", stats.newCount],
            ["Reviewed", stats.reviewed],
            ["Resolved", stats.resolved],
          ].map(([label, value]) => (
            <article
              key={String(label)}
              className="asp-admin-section p-5"
            >
              <p className="text-sm font-semibold text-[#66758A]">{label}</p>

              <p className="mt-3 text-3xl font-extrabold text-[#0B1026]">
                {value}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 asp-admin-section p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer or message..."
              className="rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-amber-500"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "ALL" | FeedbackStatus)
              }
              className="rounded-xl border border-gray-300 px-4 py-3"
            >
              <option value="ALL">All statuses</option>
              <option value="NEW">New</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="RESOLVED">Resolved</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value as "ALL" | FeedbackCategory,
                )
              }
              className="rounded-xl border border-gray-300 px-4 py-3"
            >
              <option value="ALL">All categories</option>
              <option value="GENERAL">General</option>
              <option value="APP_EXPERIENCE">App Experience</option>
              <option value="ASTROLOGY_CONTENT">Astrology Content</option>
              <option value="PAYMENT">Payment</option>
              <option value="CONSULTATION">Consultation</option>
              <option value="TECHNICAL">Technical</option>
              <option value="SUGGESTION">Suggestion</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {errorMessage ? (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {isLoading ? (
            <div className="py-16 text-center font-semibold text-[#4B5C73]">
              Loading feedback...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center">
              <h2 className="text-xl font-extrabold text-[#0B1026]">
                No feedback found
              </h2>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="asp-admin-table-head">
                  <tr className="border-b border-gray-200 text-sm text-[#66758A]">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Rating</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="border-b border-gray-100 px-4 py-5">
                        <p className="font-bold text-[#0B1026]">
                          {item.customer?.name || "Customer"}
                        </p>

                        <p className="mt-1 text-xs text-[#66758A]">
                          {item.customer?.phone ||
                            item.customer?.email ||
                            item.customerId}
                        </p>
                      </td>

                      <td className="border-b border-gray-100 px-4 py-5">
                        {categoryLabel(item.category)}
                      </td>

                      <td className="border-b border-gray-100 px-4 py-5 font-bold">
                        {item.rating ?? "-"}
                        {item.rating ? "/5" : ""}
                      </td>

                      <td className="max-w-sm border-b border-gray-100 px-4 py-5">
                        <p className="line-clamp-3">{item.message}</p>
                      </td>

                      <td className="border-b border-gray-100 px-4 py-5">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                            item.status,
                          )}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="border-b border-gray-100 px-4 py-5 text-sm text-[#4B5C73]">
                        {formatDate(item.createdAt)}
                      </td>

                      <td className="border-b border-gray-100 px-4 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => void openDetail(item.id)}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-[#0B1026]"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  Feedback Detail
                </p>

                <h2 className="mt-1 text-2xl font-extrabold text-[#0B1026]">
                  {selected.customer?.name || "Customer"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-gray-300 px-3 py-2 font-bold"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase text-[#66758A]">
                  Category
                </p>
                <p className="mt-1 font-semibold">
                  {categoryLabel(selected.category)}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase text-[#66758A]">
                  Rating
                </p>
                <p className="mt-1 font-semibold">
                  {selected.rating ? `${selected.rating}/5` : "-"}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-bold uppercase text-[#66758A]">
                Customer Message
              </p>

              <p className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-50 p-4 leading-7">
                {selected.message}
              </p>
            </div>

            <div className="mt-6">
              <label className="text-xs font-bold uppercase text-[#66758A]">
                Admin Note
              </label>

              <textarea
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Internal admin note..."
                className="mt-2 asp-admin-input w-full p-4 outline-none focus:border-amber-500"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void updateStatus("NEW")}
                disabled={isUpdating}
                className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-bold text-amber-800 disabled:opacity-60"
              >
                Mark New
              </button>

              <button
                type="button"
                onClick={() => void updateStatus("REVIEWED")}
                disabled={isUpdating}
                className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 font-bold text-blue-800 disabled:opacity-60"
              >
                Mark Reviewed
              </button>

              <button
                type="button"
                onClick={() => void updateStatus("RESOLVED")}
                disabled={isUpdating}
                className="rounded-xl border border-green-300 bg-green-50 px-4 py-3 font-bold text-green-800 disabled:opacity-60"
              >
                Mark Resolved
              </button>
            </div>

            {isUpdating ? (
              <p className="mt-4 text-sm font-semibold text-[#66758A]">
                Updating feedback...
              </p>
            ) : null}

            <div className="mt-6 border-t border-gray-200 pt-4 text-sm text-[#66758A]">
              <p>Created: {formatDate(selected.createdAt)}</p>
              <p>Reviewed: {formatDate(selected.reviewedAt)}</p>
              <p>Resolved: {formatDate(selected.resolvedAt)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

