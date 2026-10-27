import Link from "next/link";
import type { ReactNode } from "react";
import { CelestialArtwork } from "@/features/home/CelestialArtwork";
import s from "./auth-premium.module.css";
export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  professional = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  professional?: boolean;
}) {
  return (
    <main className={s.page}>
      <div className={s.shell}>
        <aside className={s.artPanel} aria-label="Astro Soul Path introduction">
          <Link href="/" className={s.brand}>
            ✧ Astro Soul Path
          </Link>
          <div className={s.artCopy}>
            <p>
              {professional
                ? "For the professional journey"
                : "A little perspective. A world of possibility."}
            </p>
            <h2>
              {professional ? (
                <>
                  Share your wisdom.
                  <br />
                  <em>Guide with care.</em>
                </>
              ) : (
                <>
                  Your questions.
                  <br />
                  Your pace.
                  <br />
                  <em>Your path.</em>
                </>
              )}
            </h2>
            <p>
              {professional
                ? "Access your existing professional account. Onboarding, verification and approval requirements remain part of the journey."
                : "Explore Vedic wisdom, real astrologer profiles and the experiences already available to your account."}
            </p>
          </div>
          <CelestialArtwork variant={professional ? 0 : 1} className={s.art} />
          {!professional && (
            <div className={s.customerOrbit} aria-hidden="true">
              <span />
              <i />
            </div>
          )}
          <span className={s.artCaption}>
            Original celestial illustration · not a personal chart
          </span>
        </aside>
        <section className={s.formPanel} aria-labelledby="auth-title">
          <p className={s.eyebrow}>{eyebrow}</p>
          <h1 id="auth-title">{title}</h1>
          <p className={s.description}>{description}</p>
          {children}
          <p className={s.legal}>
            Read our <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy-policy">Privacy Policy</Link>. Need a hand?{" "}
            <Link href="/contact">Contact support</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
