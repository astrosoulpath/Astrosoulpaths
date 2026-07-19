import type { ReactNode } from "react";

type InfoPageProps = {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function InfoPage({
  badge,
  title,
  description,
  children,
}: InfoPageProps) {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#B58D16]">
            {badge}
          </p>

          <h1 className="mt-4 text-4xl font-bold text-[#0B1026]">
            {title}
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            {description}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </section>
    </main>
  );
}