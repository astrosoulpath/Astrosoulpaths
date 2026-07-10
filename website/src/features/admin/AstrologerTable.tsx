"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AdminAstrologer,
  approveAstrologer,
  getAdminAstrologers,
  suspendAstrologer,
} from "@/services/adminService";

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "SUSPENDED";

function getAstrologerStatus(
  astrologer: AdminAstrologer,
): Exclude<StatusFilter, "ALL"> {
  if (astrologer.isApproved && astrologer.isVerified) {
    return "APPROVED";
  }

  if (!astrologer.isApproved && !astrologer.isVerified) {
    return "PENDING";
  }

  return "SUSPENDED";
}

function StatusBadge({
  status,
}: {
  status: Exclude<StatusFilter, "ALL">;
}) {
  const styles = {
    APPROVED: "bg-green-100 text-green-700",
    PENDING: "bg-amber-100 text-amber-700",
    SUSPENDED: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function AstrologerTable() {
  const [astrologers, setAstrologers] = useState<AdminAstrologer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function loadAstrologers() {
    try {
      setLoading(true);
      setError("");

      const response = await getAdminAstrologers();

      setAstrologers(
        Array.isArray(response?.data) ? response.data : [],
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load astrologers.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    try {
      setActionId(id);
      setError("");

      await approveAstrologer(id);
      await loadAstrologers();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to approve astrologer.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function handleSuspend(id: string) {
    try {
      setActionId(id);
      setError("");

      await suspendAstrologer(id);
      await loadAstrologers();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to suspend astrologer.",
      );
    } finally {
      setActionId(null);
    }
  }

  useEffect(() => {
    void loadAstrologers();
  }, []);

  const filteredAstrologers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return astrologers.filter((astrologer) => {
      const status = getAstrologerStatus(astrologer);

      const expertise =
        astrologer.expertise
          ?.map((item) => item.expertise?.name ?? "")
          .join(" ")
          .toLowerCase() ?? "";

      const languages =
        astrologer.languages?.join(" ").toLowerCase() ?? "";

      const matchesSearch =
        !query ||
        astrologer.id.toLowerCase().includes(query) ||
        expertise.includes(query) ||
        languages.includes(query);

      const matchesStatus =
        statusFilter === "ALL" || status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [astrologers, search, statusFilter]);

  return (
    <section className="mt-10 rounded-2xl bg-white p-6 shadow">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#0B1026]">
            Astrologer Approval Management
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Review, approve and suspend astrologer accounts.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAstrologers()}
          disabled={loading}
          className="rounded-xl border px-5 py-3 font-semibold text-[#0B1026] disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <input
          type="search"
          placeholder="Search by language, expertise or ID"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-xl border p-4"
        />

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StatusFilter)
          }
          className="rounded-xl border p-4"
        >
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {error && (
        <div className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
          <p className="font-semibold">Unable to load admin data</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <p className="mt-8 text-gray-600">
          Loading astrologers...
        </p>
      )}

      {!loading && !error && filteredAstrologers.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed p-8 text-center text-gray-500">
          No astrologers found.
        </div>
      )}

      {!loading && filteredAstrologers.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-4">Astrologer</th>
                <th className="p-4">Experience</th>
                <th className="p-4">Languages</th>
                <th className="p-4">Expertise</th>
                <th className="p-4">Price/min</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAstrologers.map((astrologer) => {
                const status = getAstrologerStatus(astrologer);
                const isUpdating = actionId === astrologer.id;

                return (
                  <tr
                    key={astrologer.id}
                    className="border-b align-top"
                  >
                    <td className="p-4">
                      <p className="font-semibold text-[#0B1026]">
                        Astrologer
                      </p>
                      <p className="mt-1 max-w-[220px] break-all text-xs text-gray-500">
                        {astrologer.id}
                      </p>
                    </td>

                    <td className="p-4">
                      {astrologer.experience ?? 0} years
                    </td>

                    <td className="p-4">
                      {astrologer.languages?.length
                        ? astrologer.languages.join(", ")
                        : "-"}
                    </td>

                    <td className="p-4">
                      {astrologer.expertise
                        ?.map((item) => item.expertise?.name)
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </td>

                    <td className="p-4">
                      ₹{astrologer.pricePerMin ?? 0}
                    </td>

                    <td className="p-4">
                      <StatusBadge status={status} />
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {status !== "APPROVED" && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              void handleApprove(astrologer.id)
                            }
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {isUpdating ? "Updating..." : "Approve"}
                          </button>
                        )}

                        {status === "APPROVED" && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              void handleSuspend(astrologer.id)
                            }
                            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {isUpdating ? "Updating..." : "Suspend"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}