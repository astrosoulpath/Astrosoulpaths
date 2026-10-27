"use client";

import Link from "next/link";
import { AdminArticleManagement } from "@/features/admin/AdminArticleManagement";

export default function AdminArticlesPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/admin"
          className="mb-6 inline-flex rounded-xl border border-[#E5EAF1] px-4 py-2 text-sm font-bold text-[#14243D] hover:border-amber-400 hover:text-[#8A6818]"
        >
          ← Back to Admin Dashboard
        </Link>

        <AdminArticleManagement />
      </div>
    </main>
  );
}