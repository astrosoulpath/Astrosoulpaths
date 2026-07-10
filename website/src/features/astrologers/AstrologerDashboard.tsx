"use client";

import { useEffect, useState } from "react";
import {
  AstrologerDashboardData,
  getAstrologerDashboard,
  updateAstrologerStatus,
} from "@/services/astrologerDashboardService";
import { KundliToolsPanel } from "./KundliToolsPanel";

export function AstrologerDashboard() {
  const [dashboard, setDashboard] = useState<AstrologerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");
      const response = await getAstrologerDashboard();
      setDashboard(response.data);
    } catch (err: any) {
      setError(err?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus() {
    if (!dashboard) return;

    try {
      setStatusLoading(true);
      const nextStatus = !dashboard.isOnline;
      await updateAstrologerStatus(nextStatus);
      setDashboard((prev) => (prev ? { ...prev, isOnline: nextStatus } : prev));
    } catch (err: any) {
      setError(err?.message || "Failed to update status");
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const isOnline = dashboard?.isOnline ?? false;

  return (
    <main className="min-h-screen bg-[#FAF7F0] py-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-4xl font-bold text-[#0B1026]">Astrologer Dashboard</h1>
            <p className="mt-2 text-gray-600">Welcome to Astro Soul Path Professional Panel</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Live Availability</p>

            <div className="mt-3 flex items-center gap-4">
              <span className={`h-3 w-3 rounded-full ${isOnline ? "bg-green-500" : "bg-gray-400"}`} />
              <span className="font-semibold">{isOnline ? "Online" : "Offline"}</span>

              <button
                onClick={handleToggleStatus}
                disabled={statusLoading || loading}
                className={`rounded-xl px-5 py-2 font-semibold text-white disabled:opacity-60 ${
                  isOnline ? "bg-red-600" : "bg-green-600"
                }`}
              >
                {statusLoading ? "Updating..." : isOnline ? "Go Offline" : "Go Online"}
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              {isOnline
                ? "You are ready to receive chat and audio consultation requests."
                : "You are not visible for live consultations right now."}
            </p>
          </div>
        </div>

        {loading && <p className="mt-8 rounded-xl bg-white p-4 shadow">Loading dashboard...</p>}

        {error && <p className="mt-8 rounded-xl bg-red-50 p-4 text-red-600 shadow">{error}</p>}

        {!loading && dashboard && (
          <>
            <div className="mt-8 grid gap-6 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-6 shadow">
                <h3>Total Earnings</h3>
                <p className="mt-3 text-3xl font-bold">₹{dashboard.earnings}</p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow">
                <h3>Today's Calls</h3>
                <p className="mt-3 text-3xl font-bold">{dashboard.todayCalls}</p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow">
                <h3>Today's Chats</h3>
                <p className="mt-3 text-3xl font-bold">{dashboard.todayChats}</p>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow">
                <h3>Rating</h3>
                <p className="mt-3 text-3xl font-bold">{dashboard.rating} ⭐</p>
              </div>
            </div>

            <div className="mt-10 rounded-2xl bg-white p-8 shadow">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <h2 className="text-2xl font-bold">Profile Completion</h2>
                  <p className="mt-2 text-gray-500">
                    Complete all steps to start receiving consultations.
                  </p>
                </div>
                <p className="text-3xl font-bold text-[#D4AF37]">{dashboard.profileCompletion}%</p>
              </div>

              <div className="mt-5 h-3 rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-[#D4AF37]"
                  style={{ width: `${dashboard.profileCompletion}%` }}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Languages</p>
                  <p className="text-gray-600">{dashboard.languages.join(", ") || "Pending"}</p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Expertise</p>
                  <p className="text-gray-600">{dashboard.expertise.join(", ") || "Pending"}</p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Pricing</p>
                  <p className="text-gray-600">₹{dashboard.pricePerMin}/min</p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Experience</p>
                  <p className="text-gray-600">{dashboard.experience} years</p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Approval</p>
                  <p className={dashboard.isApproved ? "text-green-600" : "text-red-600"}>
                    {dashboard.isApproved ? "Approved" : "Pending"}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="font-semibold">Verification</p>
                  <p className={dashboard.isVerified ? "text-green-600" : "text-red-600"}>
                    {dashboard.isVerified ? "Verified" : "Pending"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-white p-8 shadow">
                <h2 className="text-2xl font-bold">Pending Consultations</h2>
                <p className="mt-4 text-gray-500">
                  {dashboard.pendingConsultations} pending consultations.
                </p>
              </div>

              <div className="rounded-2xl bg-white p-8 shadow">
                <h2 className="text-2xl font-bold">Today’s Schedule</h2>
                <p className="mt-4 text-gray-500">
                  {dashboard.todaySchedule.length === 0
                    ? "No scheduled sessions yet."
                    : `${dashboard.todaySchedule.length} sessions scheduled.`}
                </p>
              </div>
            </div>

            <KundliToolsPanel />
          </>
        )}
      </div>
    </main>
  );
}