"use client";

import { useState } from "react";
import { MarketplaceProducts } from "./MarketplaceProducts";
import { MarketplaceSellers } from "./MarketplaceSellers";
import { MarketplaceCategories } from "./MarketplaceCategories";
import { MarketplaceOrders } from "./MarketplaceOrders";
import { MarketplaceFinance } from "./MarketplaceFinance";
import MarketplaceCampaigns from "./MarketplaceCampaigns";

type MarketplaceTab =
  "sellers" | "products" | "categories" | "orders" | "finance" | "campaigns";

const MARKETPLACE_TABS: MarketplaceTab[] = [
  "sellers",
  "products",
  "categories",
  "orders",
  "finance",
  "campaigns",
];

export function MarketplaceManagement() {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>("products");

  return (
    <section
      id="marketplace-management"
      className="mt-8 scroll-mt-24 rounded-[26px] border border-slate-700/70 bg-slate-900/55 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur"
    >
      <div>
        <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-400">
          Marketplace Administration
        </p>

        <h2 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Marketplace Management
        </h2>

        <p className="mt-2 text-base text-slate-400">
          Manage marketplace sellers, product approvals, categories, orders,
          finance and campaigns from the main Admin Dashboard.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {MARKETPLACE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-xl border px-5 py-2.5 text-sm font-black capitalize transition ${
              activeTab === tab
                ? "border-amber-400 bg-amber-400 text-black"
                : "border-slate-700 bg-slate-950 text-slate-300 hover:border-amber-400/60"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-6">
        {activeTab === "sellers" ? <MarketplaceSellers /> : null}

        {activeTab === "products" ? <MarketplaceProducts /> : null}

        {activeTab === "categories" ? <MarketplaceCategories /> : null}

        {activeTab === "orders" ? <MarketplaceOrders /> : null}

        {activeTab === "finance" ? <MarketplaceFinance /> : null}

        {activeTab === "campaigns" ? <MarketplaceCampaigns /> : null}
      </div>
    </section>
  );
}
