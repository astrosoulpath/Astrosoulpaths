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

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-[#050b14] text-white">
      <div className="flex min-h-screen">
        <aside className="relative hidden w-72 shrink-0 border-r border-slate-800/80 bg-[linear-gradient(180deg,#0b1424_0%,#08101d_55%,#060c16_100%)] shadow-[12px_0_40px_rgba(0,0,0,0.18)] lg:block">
          <div className="border-b border-slate-800/80 px-6 py-7">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-400">
              Astro Soul Path
            </p>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-white">
              Admin Panel
            </h1>

            <p className="mt-1 text-sm font-medium text-slate-500">
              Platform management
            </p>
          </div>

          <nav className="space-y-1.5 p-4">
            {adminNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group block rounded-xl border border-transparent px-4 py-3 text-sm font-bold text-slate-400 transition duration-200 hover:border-amber-400/20 hover:bg-amber-400/[0.07] hover:text-amber-300"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-0 hidden w-72 border-t border-slate-800/80 bg-[#07101c]/95 p-4 lg:block">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-inner">
              <p className="text-sm font-medium text-white">Admin Access</p>

              <p className="mt-1 text-xs leading-5 text-slate-400">
                Protected routes require a valid administrator session.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between border-b border-slate-800/80 bg-[#08111f]/90 px-5 shadow-[0_10px_35px_rgba(0,0,0,0.16)] backdrop-blur-xl lg:px-8">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-400">
                Administration
              </p>

              <h2 className="mt-1 text-lg font-black tracking-tight text-white">
                Management Dashboard
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-white">Administrator</p>

                <p className="text-xs text-slate-400">Astro Soul Path</p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-300/20 to-amber-500/5 text-sm font-black text-amber-300 shadow-[0_8px_25px_rgba(245,158,11,0.12)]">
                A
              </div>
            </div>
          </header>

          <main className="flex-1 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.035),_transparent_30%)] p-5 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
