"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AstrologerTable } from "./components/AstrologerTable";
type DashboardStats = {
  users: {
    total: number;
  };
  astrologers: {
    total: number;
    pending: number;
    approved: number;
    verified: number;
    online: number;
  };
  consultations: {
    totalCallSessions: number;
  };
  payments: {
    totalOrders: number;
    successfulOrders: number;
    successfulAmount: number | string;
    averageSuccessfulAmount: number | string;
    refundedOrders: number;
    refundedAmount: number | string;
  };
  wallets: {
    totalWallets: number;
    totalBalance: number | string;
    totalLockedBalance: number | string;
  };
  reviews: {
    total: number;
  };
};

type DashboardResponse = {
  success: boolean;
  data: DashboardStats;
  message?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const modules = [
  {
    title: "Manage Customers",
    description: "View users, profiles, wallets and account activity.",
    href: "/admin/customers",
  },
  {
    title: "Support Tickets",
    description:
      "Manage 24x7 customer support, replies, assignment and resolution.",
    href: "/admin/support",
  },
  {
    title: "Customer Feedback",
    description: "Review customer ratings, messages, status and admin notes.",
    href: "/admin/feedback",
  },
  {
    title: "Approve Astrologers",
    description: "Review pending astrologers and manage approval status.",
    href: "/admin/astrologers",
  },
  {
    title: "Manage Consultations",
    description: "Monitor audio calls, chat sessions and consultation history.",
    href: "/admin/consultations",
  },
  {
    title: "Wallet & Transactions",
    description: "Review wallet balances, ledger entries and deductions.",
    href: "/admin/wallet",
  },
  {
    title: "Payments",
    description: "Track successful, pending, failed and refunded payments.",
    href: "/admin/payments",
  },
  {
    title: "Subscriptions",
    description: "Manage active plans and subscription activity.",
    href: "/admin/subscriptions",
  },
  {
    title: "Platform Analytics",
    description: "View revenue, usage and consultation performance.",
    href: "/admin/reports",
  },
  {
    title: "Reports",
    description: "Generate operational and financial reports.",
    href: "/admin/reports",
  },
  {
    title: "Kundli Settings",
    description: "Professional Kundli plan, charts and report controls",
    href: "/admin/kundli-settings",
    icon: "\u{1F52F}",
  },
  {
    title: "Marketplace",
    description:
      "Manage sellers, products, categories, approvals and campaigns.",
    href: "/admin/marketplace",
  },
  {
    title: "Platform Settings",
    description: "Manage platform commission and astrologer revenue share.",
    href: "/admin/platform-settings",
  },
];

function formatCurrency(value: number | string | null | undefined) {
  const parsedValue = typeof value === "string" ? Number(value) : (value ?? 0);

  if (!Number.isFinite(parsedValue)) {
    return "\u20B90";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(parsedValue);
}

function getStoredAdminToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("asp_admin_access_token") ??
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardStats() {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const accessToken = getStoredAdminToken();

        if (!accessToken) {
          throw new Error(
            "Admin authentication is not connected yet. Dashboard preview is available with temporary values.",
          );
        }

        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const result = (await response.json()) as DashboardResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              `Unable to load admin dashboard (${response.status}).`,
          );
        }

        if (isMounted) {
          setStats(result.data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load admin dashboard.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboardStats();

    return () => {
      isMounted = false;
    };
  }, []);

  const dashboardCards = [
    {
      title: "Total Customers",
      value: stats?.users.total ?? 0,
      description: "Registered customer accounts",
    },
    {
      title: "Pending Astrologers",
      value: stats?.astrologers.pending ?? 0,
      description: "Awaiting admin approval",
    },
    {
      title: "Approved Astrologers",
      value: stats?.astrologers.approved ?? 0,
      description: "Approved platform astrologers",
    },
    {
      title: "Online Astrologers",
      value: stats?.astrologers.online ?? 0,
      description: "Currently marked online",
    },
    {
      title: "Consultations",
      value: stats?.consultations.totalCallSessions ?? 0,
      description: "Total call and chat sessions",
    },
    {
      title: "Successful Revenue",
      value: formatCurrency(stats?.payments.successfulAmount),
      description: `${stats?.payments.successfulOrders ?? 0} successful payments`,
    },
    {
      title: "Wallet Balance",
      value: formatCurrency(stats?.wallets.totalBalance),
      description: `${stats?.wallets.totalWallets ?? 0} customer wallets`,
    },
    {
      title: "Refunded Amount",
      value: formatCurrency(stats?.payments.refundedAmount),
      description: `${stats?.payments.refundedOrders ?? 0} refunded payments`,
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-800/80 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.08),_transparent_32%),linear-gradient(145deg,#07101f_0%,#0a1324_48%,#070d18_100%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.38)] sm:p-7 lg:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-400">
            Platform Overview
          </p>

          <h1 className="mt-2 text-4xl font-black tracking-tight text-white sm:text-5xl">
            Admin Dashboard
          </h1>

          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-400 sm:text-lg">
            Monitor customers, astrologers, consultations, payments, wallets and
            overall platform activity.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-xs font-semibold text-slate-400 shadow-inner backdrop-blur">
          API: {API_BASE_URL}
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
          <p className="font-medium text-amber-300">
            Admin data is not connected yet
          </p>

          <p className="mt-1 text-sm leading-6 text-amber-100/80">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((item) => (
          <article
            key={item.title}
            className="group relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.22)] backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-[0_18px_45px_rgba(0,0,0,0.34)]"
          >
            <p className="text-sm font-bold uppercase tracking-wide text-slate-400">
              {item.title}
            </p>

            <h2 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">
              {isLoading ? "..." : item.value}
            </h2>

            <p className="mt-3 text-sm font-medium leading-6 text-slate-500">
              {item.description}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-[26px] border border-slate-700/70 bg-slate-900/55 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-400">
            Administration
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Management Modules
          </h2>

          <p className="mt-2 text-base text-slate-400">
            Open a module to manage the corresponding platform area.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <Link
              key={`${module.href}-${module.title}`}
              href={module.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/75 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:border-amber-400/60 hover:bg-slate-900 hover:shadow-[0_16px_40px_rgba(0,0,0,0.30)]"
            >
              <h3 className="text-lg font-black tracking-tight text-white transition group-hover:text-amber-300">
                {module.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                {module.description}
              </p>

              <p className="mt-5 inline-flex items-center gap-2 text-sm font-black text-amber-400 transition group-hover:text-amber-300">
                Open module <span aria-hidden="true">&rarr;</span>
              </p>
            </Link>
          ))}
        </div>
      </section>
<section className="mt-8 rounded-[26px] border border-slate-700/70 bg-slate-900/55 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-400">
            Astrologer Management
          </p>

          <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Recent Astrologers
          </h2>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/70 shadow-[0_12px_35px_rgba(0,0,0,0.22)]">
          <AstrologerTable />
        </div>
      </section>
    </section>
  );
}

