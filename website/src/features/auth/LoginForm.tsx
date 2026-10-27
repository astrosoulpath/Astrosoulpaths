"use client";
import { PortalLoginForm } from "./PortalLoginForm";
export function LoginForm({
  redirectTo = "/dashboard",
  initialMethod = "phone",
}: {
  redirectTo?: string;
  initialMethod?: "phone" | "email";
}) {
  return (
    <PortalLoginForm
      portal="customer"
      redirectTo={redirectTo}
      initialMethod={initialMethod}
    />
  );
}
