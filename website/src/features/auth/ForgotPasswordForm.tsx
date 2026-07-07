import Link from "next/link";

export function ForgotPasswordForm() {
  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-[#0B1026]">
          Forgot Password
        </h1>

        <p className="mt-2 text-[#374151]">
          Enter your email address. We will send you reset instructions.
        </p>

        <form className="mt-8 space-y-5">
          <input
            type="email"
            placeholder="Email address"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37]"
          />

          <button className="w-full rounded-xl bg-[#D4AF37] py-3 font-semibold text-[#0B1026]">
            Send Reset Link
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#374151]">
          Remember password?{" "}
          <Link href="/login" className="font-semibold text-[#D4AF37]">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}