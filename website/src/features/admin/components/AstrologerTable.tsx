"use client";

import { useEffect, useState } from "react";
import {
  AdminAstrologer,
  approveAstrologer,
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

  async function handleSuspend(id: string) {
    await suspendAstrologer(id);
    await loadAstrologers();
  }

  useEffect(() => {
    loadAstrologers();
  }, []);

  return (
    <div className="mt-10 rounded-2xl bg-white p-6 shadow">
      <h2 className="text-2xl font-bold text-[#0B1026]">
        Astrologer Approval Management
      </h2>

      {loading && <p className="mt-6 text-gray-600">Loading astrologers...</p>}

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-3 text-red-600">{error}</p>
      )}

      {!loading && !error && astrologers.length === 0 && (
        <p className="mt-6 text-gray-600">No astrologers found.</p>
      )}

      {!loading && !error && astrologers.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="p-4">ID</th>
                <th className="p-4">Experience</th>
                <th className="p-4">Languages</th>
                <th className="p-4">Specialties</th>
                <th className="p-4">Price/min</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {astrologers.map((astrologer) => (
                <tr key={astrologer.id} className="border-b">
                  <td className="p-4 font-semibold">{astrologer.id}</td>

                  <td className="p-4">
                    {astrologer.experience ?? 0} years
                  </td>

                  <td className="p-4">
                    {astrologer.languages?.join(", ") || "-"}
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
                    <StatusBadge status={getStatus(astrologer)} />
                  </td>

                  <td className="p-4">
                    <ActionButtons
                      onApprove={() => handleApprove(astrologer.id)}
                      onReject={() => handleSuspend(astrologer.id)}
                      onSuspend={() => handleSuspend(astrologer.id)}
                    />
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