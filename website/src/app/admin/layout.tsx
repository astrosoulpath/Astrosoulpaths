import type { ReactNode } from "react";
import { AdminSessionBoundary } from "@/features/admin/auth/AdminSessionBoundary";
import { AdminShell } from "@/features/admin/ui/AdminShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminSessionBoundary><AdminShell>{children}</AdminShell></AdminSessionBoundary>;
}
