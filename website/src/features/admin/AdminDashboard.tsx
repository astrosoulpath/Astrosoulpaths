"use client";
import Link from "next/link";
import { adminModules } from "./ui/admin-navigation";
import { AdminIcon } from "./ui/AdminIcon";
import { AdminWelcomeArt } from "./ui/AdminWelcomeArt";
import { AdminStatCard, AdminSectionCard, AdminModuleLink, AdminLoadingState, AdminErrorState } from "./ui/AdminUI";
import { useEffect, useState } from "react";

import { AstrologerTable } from "./components/AstrologerTable";
import { adminFetch } from "./auth/admin-session";
type CurrencyAmount = {currency: string; amount: number | string | null};

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
    successfulAmount: number | string | null;
    successfulAmountByCurrency?: CurrencyAmount[];
    averageSuccessfulAmount: number | string;
    refundedOrders: number;
    refundedAmount: number | string | null;
    refundedAmountByCurrency?: CurrencyAmount[];
  };
  wallets: {
    totalWallets: number;
    totalBalance: number | string | null;
    totalBalanceByCurrency?: CurrencyAmount[];
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

const modules = adminModules;

function formatCurrencies(rows?: CurrencyAmount[]) {
  if (!rows) return "Unavailable";
  if (!rows.length) return "No records";
  return rows.map(({currency, amount}) => {
    if (amount === null || !/^[A-Z]{3}$/.test(currency) || !Number.isFinite(Number(amount))) return "Unavailable";
    return new Intl.NumberFormat("en", {style:"currency", currency, currencyDisplay:"code"}).format(Number(amount));
  }).join(" / ");
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

        const response = await adminFetch("/admin/stats", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        });

        const result = (await response.json()) as DashboardResponse;

        if (!response.ok || !result.success || !result.data) {
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
      value: stats?.users?.total ?? "Unavailable",
      description: "Registered customer accounts",
    },
    {
      title: "Pending Astrologers",
      value: stats?.astrologers?.pending ?? "Unavailable",
      description: "Awaiting admin approval",
    },
    {
      title: "Approved Astrologers",
      value: stats?.astrologers?.approved ?? "Unavailable",
      description: "Approved platform astrologers",
    },
    {
      title: "Online Astrologers",
      value: stats?.astrologers?.online ?? "Unavailable",
      description: "Currently marked online",
    },
    {
      title: "Consultations",
      value: stats?.consultations?.totalCallSessions ?? "Unavailable",
      description: "Total call and chat sessions",
    },
    {
      title: "Successful Revenue",
      value: formatCurrencies(stats?.payments?.successfulAmountByCurrency),
      description: `${stats?.payments?.successfulOrders ?? "Unavailable"} successful payments`,
    },
    {
      title: "Wallet Balance",
      value: formatCurrencies(stats?.wallets?.totalBalanceByCurrency),
      description: `${stats?.wallets?.totalWallets ?? "Unavailable"} customer wallets`,
    },
    {
      title: "Refunded Amount",
      value: formatCurrencies(stats?.payments?.refundedAmountByCurrency),
      description: `${stats?.payments?.refundedOrders ?? "Unavailable"} refunded payments`,
    },
  ];

  if (isLoading) return <AdminLoadingState label="Loading verified Admin dashboard..."/>;
  if (errorMessage || !stats) return <AdminErrorState title="Dashboard unavailable" actions={<div className="flex flex-wrap gap-4"><button type="button" onClick={() => window.location.reload()} className="admin-action">Retry</button><Link href="/admin/login" className="admin-action">Admin sign-in</Link></div>}>{errorMessage || "No dashboard data was returned."}</AdminErrorState>;
  const statIcons = ["customers","astrologers","astrologers","astrologers","consultations","finance","wallet","payments"];
  return <div>
    <section className="admin-welcome" aria-labelledby="admin-welcome-title">
      <div><p className="admin-eyebrow">Your administration workspace</p><h1 id="admin-welcome-title">Welcome to AstroSoulPath</h1><p>Monitor and manage your platform in real time.</p></div>
      <AdminWelcomeArt/>
    </section>
    <section className="admin-kpi-grid" aria-label="Verified platform statistics">
      {dashboardCards.map((item,index)=><AdminStatCard key={item.title} title={item.title} value={item.value} description={item.description} icon={<AdminIcon name={statIcons[index]}/>}/>)}
    </section>
    <AdminSectionCard title="Administration Modules" description="Everything you need to keep your platform running smoothly.">
      <div className="admin-module-grid">{modules.map(module=><AdminModuleLink key={module.href} href={module.href} title={module.title} description={module.description} icon={<AdminIcon name={module.icon}/>}/>)}</div>
    </AdminSectionCard>
    <AdminSectionCard title="Recent Astrologers" description="Review existing profiles and manage their approval status." actions={<Link href="/admin/astrologers" className="admin-action">View all astrologers</Link>}>
      <AstrologerTable/>
    </AdminSectionCard>
  </div>;
}
