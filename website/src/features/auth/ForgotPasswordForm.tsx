import Link from "next/link";
import { AuthShell } from "./AuthShell";
import s from "./auth-premium.module.css";
export function ForgotPasswordForm() {
  return (
    <AuthShell
      eyebrow="Account access"
      title="Let’s find your way back"
      description="Use an existing verified sign-in method or contact support for account-specific recovery."
    >
      <div className={s.choices}>
        <Link href="/login" className={s.choice}>
          <span aria-hidden="true">↗</span>
          <span>
            <strong>Use phone verification or Google</strong>
            <small>
              Return to Customer Login and choose an existing method linked to
              your account.
            </small>
          </span>
        </Link>
        <Link href="/contact" className={s.choice}>
          <span aria-hidden="true">✧</span>
          <span>
            <strong>Contact support</strong>
            <small>
              A complete website password-reset flow is not currently connected.
              No reset email has been requested.
            </small>
          </span>
        </Link>
      </div>
      <p className={s.alternate}>
        <Link href="/login">Back to Customer Login</Link>
      </p>
    </AuthShell>
  );
}
