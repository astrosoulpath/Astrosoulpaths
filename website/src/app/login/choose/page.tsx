import Link from "next/link";
import { UserRound, Orbit, Sparkles, ArrowUpRight } from "lucide-react";
import { AuthShell } from "@/features/auth/AuthShell";
import s from "@/features/auth/auth-premium.module.css";
export default function LoginChoicePage() {
  return (
    <AuthShell
      eyebrow="A place for every journey"
      title="How would you like to continue?"
      description="Choose the existing account experience that is right for you."
    >
      <div className={s.choices}>
        <Link className={s.choice} href="/login">
          <UserRound size={25} />
          <span>
            <strong>Customer Login</strong>
            <small>Explore your consultations, readings and account.</small>
          </span>
          <ArrowUpRight size={17} />
        </Link>
        <Link className={s.choice} href="/astrologer/login">
          <Orbit size={25} />
          <span>
            <strong>Astrologer Login</strong>
            <small>
              Return to your professional account and application status.
            </small>
          </span>
          <ArrowUpRight size={17} />
        </Link>
        <Link className={s.choice} href="/astrologer/register">
          <Sparkles size={25} />
          <span>
            <strong>Apply as Astrologer</strong>
            <small>
              New to the professional journey? Start the existing application
              process.
            </small>
          </span>
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <p className={s.alternate}>
        New customer? <Link href="/signup">Create your account</Link>
      </p>
    </AuthShell>
  );
}
