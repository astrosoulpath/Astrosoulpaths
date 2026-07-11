import { LoginForm } from "@/features/auth/LoginForm";

type LoginPageProps = {
  searchParams: Promise<{
    redirect?: string;
  }>;
};

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const { redirect } = await searchParams;

  return (
    <LoginForm
      redirectTo={
        redirect?.startsWith("/") ? redirect : "/"
      }
    />
  );
}