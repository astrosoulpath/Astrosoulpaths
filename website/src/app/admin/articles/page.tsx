"use client";

import Link from "next/link";
import { AdminArticleManagement } from "@/features/admin/AdminArticleManagement";

export default function AdminArticlesPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:border-amber-400 hover:text-amber-300"
        >
          ← Back to Admin Dashboard
        </Link>

        <AdminArticleManagement />
      </div>
    </main>
  );
}