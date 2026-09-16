"use client";

import { Headphones, Sparkles, Star, Users } from "lucide-react";
import { useEffect, useState } from "react";

import {
  getPublicDashboardStats,
  type PublicDashboardStats,
} from "@/services/dashboardService";

type StatCard = {
  label: string;
  value: string;
  icon: "astrologers" | "customers" | "consultations" | "rating";
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

function StatIcon({ type }: { type: StatCard["icon"] }) {
  const className = "h-5 w-5";

  if (type === "customers") {
    return <Users className={className} />;
  }

  if (type === "consultations") {
    return <Headphones className={className} />;
  }

  if (type === "rating") {
    return <Star className={`${className} fill-current`} />;
  }

  return <Sparkles className={className} />;
}

export function StatsSection() {
  const [stats, setStats] = useState<StatCard[]>([
    {
      value: "--",
      label: "Verified Astrologers",
      icon: "astrologers",
    },
    {
      value: "--",
      label: "Registered Customers",
      icon: "customers",
    },
    {
      value: "--",
      label: "Consultations",
      icon: "consultations",
    },
    {
      value: "--",
      label: "Average Rating",
      icon: "rating",
    },
  ]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError("");

        const response = await getPublicDashboardStats();

        const data: PublicDashboardStats = response.data;

        setStats([
          {
            value: formatNumber(data.verifiedAstrologers),
            label: "Verified Astrologers",
            icon: "astrologers",
          },
          {
            value: formatNumber(data.registeredCustomers),
            label: "Registered Customers",
            icon: "customers",
          },
          {
            value: formatNumber(data.totalConsultations),
            label: "Consultations",
            icon: "consultations",
          },
          {
            value:
              data.averageRating !== null && data.averageRating > 0
                ? data.averageRating.toFixed(1)
                : "New",
            label: "Average Rating",
            icon: "rating",
          },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load statistics.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadStats();
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#071229] py-20 sm:py-24">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,.5) 1px, transparent 0)",
          backgroundSize: "34px 34px",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-[#D4AF37]/10 blur-[100px]"
      />

      <div
        aria-hidden="true"
        className="absolute -right-28 bottom-0 h-80 w-80 rounded-full bg-indigo-400/10 blur-[100px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-12 max-w-3xl text-center sm:mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-4 py-2">
            <Sparkles className="h-3.5 w-3.5 text-[#E3C454]" />

            <span className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#E3C454]">
              Our Community
            </span>
          </div>

          <h2 className="mt-5 text-3xl font-black tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
            Trusted experiences.
            <span className="block text-white/72">Real platform activity.</span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm font-medium leading-7 text-slate-300 sm:text-base">
            Connect with verified Vedic astrologers through a secure platform
            built for personalized consultations and meaningful guidance.
          </p>
        </div>

        {error && (
          <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-center text-sm text-red-100">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.label}
              className="group relative overflow-hidden rounded-[1.5rem] border border-white/[0.09] bg-white/[0.055] p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,.12)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/35 hover:bg-white/[0.085] sm:p-7"
            >
              <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/55 to-transparent opacity-0 transition group-hover:opacity-100" />

              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/10 text-[#E3C454] sm:h-14 sm:w-14">
                <StatIcon type={item.icon} />
              </div>

              <div className="mt-5 flex items-center justify-center gap-1">
                <h3 className="text-2xl font-black tracking-tight text-[#E2C24E] sm:text-3xl lg:text-4xl">
                  {loading ? "..." : item.value}
                </h3>

                {!loading && item.icon === "rating" && item.value !== "New" && (
                  <Star className="h-4 w-4 fill-[#E2C24E] text-[#E2C24E]" />
                )}
              </div>

              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-300 sm:text-xs">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
