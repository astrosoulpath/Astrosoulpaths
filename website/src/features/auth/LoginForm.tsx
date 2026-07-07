import Link from "next/link";

export function LoginForm() {
  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-[#0B1026]">Login</h1>

        <p className="mt-2 text-[#374151]">
          Continue to AstroSoulPath
        </p>

        <form className="mt-8 space-y-5">
          <input
            type="email"
            placeholder="Email address"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37]"
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37]"
          />

          <button className="w-full rounded-xl bg-[#D4AF37] py-3 font-semibold text-[#0B1026]">
            Login
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-[#0B1026]">
            Forgot password?
          </Link>

          <Link href="/signup" className="font-semibold text-[#D4AF37]">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}