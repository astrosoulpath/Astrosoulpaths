"use client";

import { useEffect, useState } from "react";

import {
  getPublicDashboardStats,
  type PublicDashboardStats,
} from "@/services/dashboardService";

type StatCard = {
  label: string;
  value: string;
  icon: string;
};

function formatNumber(value: number): string {
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(1)}Cr+`;
  }

  if (value >= 100000) {
    return `${(value / 100000).toFixed(1)}L+`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K+`;
  }

  return value.toString();
}

export function StatsSection() {
  const [stats, setStats] =
    useState<StatCard[]>([
      {
        value: "--",
        label: "Verified Astrologers",
        icon: "🪔",
      },
      {
        value: "--",
        label: "Registered Customers",
        icon: "😊",
      },
      {
        value: "--",
        label: "Consultations",
        icon: "📞",
      },
      {
        value: "--",
        label: "Average Rating",
        icon: "⭐",
      },
    ]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError("");

        const response =
          await getPublicDashboardStats();

        const data: PublicDashboardStats =
          response.data;

        setStats([
          {
            value: formatNumber(
              data.verifiedAstrologers,
            ),
            label:
              "Verified Astrologers",
            icon: "🪔",
          },
          {
            value: formatNumber(
              data.registeredCustomers,
            ),
            label:
              "Registered Customers",
            icon: "😊",
          },
          {
            value: formatNumber(
              data.totalConsultations,
            ),
            label:
              "Consultations",
            icon: "📞",
          },
          {
            value:
              data.averageRating !==
                null &&
              data.averageRating > 0
                ? `${data.averageRating.toFixed(
                    1,
                  )}★`
                : "New",
            label: "Average Rating",
            icon: "⭐",
          },
        ]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load statistics.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadStats();
  }, []);

  return (
    <section className="bg-[#0B1026] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <p className="font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Our Community
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white md:text-4xl">
            Trusted by Thousands of Users
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-gray-300">
            Astro Soul Path helps
            people connect with
            experienced Vedic
            astrologers for secure
            consultations and
            personalized spiritual
            guidance.
          </p>
        </div>

        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="group rounded-3xl border border-white/10 bg-white/5 p-6 text-center transition duration-300 hover:-translate-y-1 hover:bg-white/10"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#D4AF37]/20 text-3xl">
                {item.icon}
              </div>

              <h3 className="mt-5 text-3xl font-bold text-[#D4AF37] md:text-4xl">
                {loading
                  ? "..."
                  : item.value}
              </h3>

              <p className="mt-3 text-sm font-medium text-gray-300">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}