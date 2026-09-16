"use client";
import Link from "next/link";

import { useEffect, useState } from "react";
import {
  AdminAstrologer,
  approveAstrologer,
  rejectAstrologer,
  getAdminAstrologers,
  suspendAstrologer,
} from "@/services/adminService";
import { ActionButtons } from "./ActionButtons";
import { StatusBadge } from "./StatusBadge";

function getStatus(astrologer: AdminAstrologer) {
  if (astrologer.isApproved && astrologer.isVerified) return "APPROVED";
  if (!astrologer.isApproved && !astrologer.isVerified) return "PENDING";
  return "SUSPENDED";
}

export function AstrologerTable() {
  const [astrologers, setAstrologers] = useState<AdminAstrologer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAstrologers() {
    try {
      setLoading(true);
      setError("");

      const response = await getAdminAstrologers();
      setAstrologers(response?.data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load astrologers.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    await approveAstrologer(id);
    await loadAstrologers();
  }

  async function handleReject(id: string) {
    await rejectAstrologer(id);
    await loadAstrologers();
  }

  async function handleSuspend(id: string) {
    await suspendAstrologer(id);
    await loadAstrologers();
  }

  useEffect(() => {
    loadAstrologers();
  }, []);

  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/55 p-5 shadow-[0_16px_45px_rgba(0,0,0,0.26)] sm:p-6">
      <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
        Astrologer Approval Management
      </h2>

      {loading && (
        <p className="mt-6 rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-5 text-sm font-medium text-slate-400">
          Loading astrologers...
        </p>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && astrologers.length === 0 && (
        <p className="mt-6 rounded-xl border border-slate-700/60 bg-slate-900/70 px-4 py-5 text-sm font-medium text-slate-400">
          No astrologers found.
        </p>
      )}

      {!loading && !error && astrologers.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/75">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-700/80 bg-slate-900/95">
                <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.12em] text-amber-400">
                  ID
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.12em] text-amber-400">
                  Experience
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.12em] text-amber-400">
                  Languages
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.12em] text-amber-400">
                  Specialties
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.12em] text-amber-400">
                  Price/min
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.12em] text-amber-400">
                  Status
                </th>
                <th className="px-4 py-4 text-xs font-black uppercase tracking-[0.12em] text-amber-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {astrologers.map((astrologer) => (
                <tr
                  key={astrologer.id}
                  className="border-b border-slate-800/90 transition duration-200 hover:bg-amber-400/[0.045]"
                >
                  <td className="max-w-[210px] px-4 py-4 font-mono text-xs font-semibold text-slate-400">
                    {astrologer.id}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-slate-300">
                    {astrologer.experience ?? 0} years
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-slate-300">
                    {astrologer.languages?.join(", ") || "-"}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-slate-300">
                    {astrologer.expertise
                      ?.map((item) => item.expertise?.name)
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-slate-300">
                    {"\u20B9"}
                    {astrologer.pricePerMin ?? 0}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-slate-300">
                    <StatusBadge status={getStatus(astrologer)} />
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-slate-300">
                    <div className="flex min-w-max flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/astrologers/${encodeURIComponent(
                          astrologer.id,
                        )}`}
                        className="rounded-lg border border-slate-600/80 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-amber-400/60 hover:bg-amber-400/10 hover:text-amber-300"
                      >
                        View Profile
                      </Link>

                      <ActionButtons
                        onApprove={() => handleApprove(astrologer.id)}
                        onReject={() => handleReject(astrologer.id)}
                        onSuspend={() => handleSuspend(astrologer.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
