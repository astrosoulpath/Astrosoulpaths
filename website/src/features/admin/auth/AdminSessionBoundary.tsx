"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onIdTokenChanged } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebaseClient";
import { logoutAdmin, refreshAdminSession } from "./admin-session";

export function AdminSessionBoundary({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    let active = true;
    const login =
      pathname === "/admin/login" || pathname === "/admin/verify-otp";
    const restore = async () => {
      if (!localStorage.getItem("asp_admin_access_token")) return;
      try {
        await refreshAdminSession();
        if (active && pathname === "/admin/login") {
          router.replace("/admin");
          router.refresh();
        }
      } catch {
        if (!active) return;
        try {
          await logoutAdmin();
        } catch {
          /* No success is claimed; protected routes still verify server-side. */
        }
        if (!login) {
          router.replace("/admin/login");
          router.refresh();
        }
      }
    };
    const unsubscribe = onIdTokenChanged(firebaseAuth, () => {
      if (localStorage.getItem("asp_admin_auth_method") === "firebase")
        void restore();
    });
    void restore();
    const timer = window.setInterval(() => {
      void restore();
    }, 60000);
    const onFocus = () => {
      void restore();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname, router]);
  return children;
}
