import Link from "next/link";
import type { ReactNode } from "react";

const adminNavigation = [
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
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-slate-900 lg:block">
          <div className="border-b border-white/10 px-6 py-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">
              Astro Soul Path
            </p>

            <h1 className="mt-2 text-2xl font-semibold text-white">
              Admin Panel
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Platform management
            </p>
          </div>

          <nav className="space-y-2 p-4">
            {adminNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-0 hidden w-72 border-t border-white/10 p-4 lg:block">
            <div className="rounded-xl bg-white/5 p-4">
              <p className="text-sm font-medium text-white">
                Admin Access
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Protected routes require a valid administrator session.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-white/10 bg-slate-900/90 px-5 backdrop-blur lg:px-8">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-400">
                Administration
              </p>

              <h2 className="mt-1 text-lg font-semibold text-white">
                Management Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white">
                  Administrator
                </p>

                <p className="text-xs text-slate-400">
                  Astro Soul Path
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-sm font-semibold text-amber-300">
                A
              </div>
            </div>
          </header>

          <main className="flex-1 p-5 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}