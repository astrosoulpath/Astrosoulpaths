import { OtpForm } from "@/features/auth/OtpForm";
import { websitePhoneAuthEnabled } from "@/features/auth/website-auth-policy";
import Link from "next/link";

export default function VerifyOtpPage() {
  return websitePhoneAuthEnabled ? <OtpForm /> : <main className="mx-auto max-w-xl p-8"><h1 className="text-2xl font-bold">Sign in with Google or email</h1><p>Phone sign-in is unavailable in this website release.</p><Link href="/login">Customer Login</Link> · <Link href="/astrologer/login">Astrologer Login</Link></main>;
}
