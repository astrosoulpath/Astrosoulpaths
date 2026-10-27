import { safeCustomerRedirect } from "@/features/auth/public-auth";
import { LoginForm } from "@/features/auth/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string;
    method?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect, method } = await searchParams;

  return <LoginForm redirectTo={safeCustomerRedirect(redirect)} initialMethod={method === "email" ? "email" : "phone"} />;
}
