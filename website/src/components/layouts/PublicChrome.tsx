"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isAdminAuthRoute, isAdminRoute } from "@/features/admin/ui/admin-navigation";

/** Layout-only boundary; never grants access or changes a session. */
export function PublicChrome({children,kind}: {children:ReactNode;kind:"navigation"|"footer"|"promotion"}) {
  const path = usePathname();
  if (isAdminRoute(path) && !(kind === "navigation" && isAdminAuthRoute(path))) return null;
  return children;
}
