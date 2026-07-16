import Link from "next/link";
import type { ReactNode } from "react";

const navigationItems = [
  {
    label: "Dashboard",
    href: "/admin",
  },
  {
    label: "Customers",
    href: "/admin/users",
  },
  {
    label: "Astrologers",
    href: "/admin/astrologers",
  },
  {
    label: "Consultations",
    href: "/admin/calls",
  },
  {
    label: "Payments",
    href: "/admin/payments",
  },
  {
    label: "Wallets",
    href: "/admin/wallets",
  },
  {
    label: "Reports",
    href: "/admin/reports",
  },
];

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-slate-900 lg:block">
          <div className="border-b border-white/10 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
              Astro Soul Path
            </p>

            <h1 className="mt-2 text-xl font-semibold">
              Admin Panel
            </h1>
          </div>

          <nav className="space-y-2 p-4">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-16 items-center justify-between border-b border-white/10 bg-slate-900/80 px-5 backdrop-blur lg:px-8">
            <div>
              <p className="text-sm text-slate-400">
                Administration
              </p>

              <h2 className="text-lg font-semibold">
                Management Dashboard
              </h2>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">
              Admin
            </div>
          </header>

          <main className="flex-1 p-5 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}