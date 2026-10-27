import Link from "next/link";
import { AdminVideoManagement } from "@/features/admin/AdminVideoManagement";

export default function AdminVideosPage() {
  return (
    <main className="min-h-screen bg-white px-4 py-8 text-[#14243D] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1900px]">
        <Link
          href="/admin"
          className="mb-5 inline-flex items-center rounded-lg border border-[#E5EAF1] px-4 py-2 text-sm font-semibold text-[#14243D] transition hover:border-yellow-400 hover:text-[#8A6818]"
        >
          ← Back to Admin Modules
        </Link>

        <AdminVideoManagement />
      </div>
    </main>
  );
}
