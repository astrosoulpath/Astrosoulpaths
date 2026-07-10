"use client";

import { AstrologerTable } from "./AstrologerTable";

export function AdminDashboard() {
  const stats = [
    {
      title: "Total Customers",
      value: "0",
      color: "bg-blue-100",
    },
    {
      title: "Pending Astrologers",
      value: "0",
      color: "bg-yellow-100",
    },
    {
      title: "Approved Astrologers",
      value: "0",
      color: "bg-green-100",
    },
    {
      title: "Today's Revenue",
      value: "₹0",
      color: "bg-purple-100",
    },
  ];

  const modules = [
    "Manage Customers",
    "Approve Astrologers",
    "Manage Consultations",
    "Wallet & Transactions",
    "Subscriptions",
    "Promotional Offers",
    "Platform Analytics",
    "Reports",
  ];

  return (
    <main className="min-h-screen bg-[#F8F8F8] p-8">
      <div className="mx-auto max-w-7xl">
        <div>
          <h1 className="text-4xl font-bold text-[#0B1026]">
            Admin Dashboard
          </h1>

          <p className="mt-3 text-gray-600">
            Astro Soul Path Administration Panel
          </p>
        </div>

        <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.title}
              className={`${item.color} rounded-2xl p-6 shadow`}
            >
              <p className="text-gray-600">{item.title}</p>

              <h2 className="mt-3 text-3xl font-bold text-[#0B1026]">
                {item.value}
              </h2>
            </div>
          ))}
        </section>

        <section className="mt-12 rounded-2xl bg-white p-8 shadow">
          <h2 className="text-2xl font-bold text-[#0B1026]">
            Administration Modules
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {modules.map((module) => (
              <button
                key={module}
                type="button"
                className="rounded-xl border p-5 text-left font-medium text-[#0B1026] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]"
              >
                {module}
              </button>
            ))}
          </div>
        </section>

        <AstrologerTable />
      </div>
    </main>
  );
}