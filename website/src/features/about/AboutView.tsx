import Link from "next/link";
import type { AboutContent } from "./about-contract";
import s from "./about.module.css";
export default function AboutView({ content }: { content: AboutContent }) {
  return (
    <article className={s.page}>
      <header className={s.hero}>
        <div>
          <p className={s.eyebrow}>ABOUT ASTRO SOUL PATH</p>
          <h1>{content.title}</h1>
          <p className={s.tagline}>Your Guide to a Brighter Tomorrow</p>
          <a href="#who-we-are" className={s.button}>
            Discover our purpose ↗
          </a>
        </div>
        <svg className={s.art} viewBox="0 0 400 400" aria-hidden="true">
          <defs>
            <radialGradient id="about-glow">
              <stop stopColor="#cfb572" stopOpacity=".2" />
              <stop offset="1" stopColor="#cfb572" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="195" fill="url(#about-glow)" />
          <g fill="none" stroke="#d9bf82">
            <circle cx="200" cy="200" r="146" opacity=".3" />
            <circle cx="200" cy="200" r="125" strokeDasharray="1 12" />
            <ellipse
              cx="200"
              cy="200"
              rx="169"
              ry="58"
              transform="rotate(-32 200 200)"
              opacity=".5"
            />
            <path
              d="M200 118C161 164 152 207 200 258C248 207 239 164 200 118ZM200 258C131 250 113 204 125 175C173 180 197 219 200 258ZM200 258C269 250 287 204 275 175C227 180 203 219 200 258Z"
              strokeWidth="2"
            />
            <path d="M182 282h36M200 67v16M192 75h16M316 239v12M310 245h12" />
          </g>
          <circle cx="65" cy="234" r="4" fill="#d9bf82" />
          <circle cx="309" cy="109" r="3" fill="#d9bf82" />
        </svg>
      </header>
      <div className={s.body}>
        <section id="who-we-are" className={s.intro}>
          <p className={s.eyebrow}>TRADITION · TECHNOLOGY · CONNECTION</p>
          <h2>Who We Are</h2>
          <p>{content.introduction}</p>
        </section>
        <div className={s.grid}>
          {(
            [
              ["mission", "Our Mission", "01"],
              ["vision", "Our Vision", "02"],
              ["services", "What We Offer", "03"],
              ["why", "Why Astro Soul Path", "04"],
              ["commitment", "Our Commitment", "05"],
            ] as const
          ).map(([key, title, n]) =>
            content[key].trim() ? (
              <section className={s.card} key={key}>
                <span className={s.number} aria-hidden="true">
                  {n}
                </span>
                <h2>{title}</h2>
                <p>{content[key]}</p>
              </section>
            ) : null,
          )}
        </div>
        <section className={s.explore}>
          <div>
            <p className={s.eyebrow}>CONTINUE YOUR JOURNEY</p>
            <h2>Explore Our Services</h2>
          </div>
          <nav aria-label="Explore astrology services">
            <Link href="/astrologers">Meet astrologers ↗</Link>
            <Link href="/horoscope">Explore horoscope ↗</Link>
            <Link href="/services">Discover services ↗</Link>
          </nav>
        </section>
      </div>
    </article>
  );
}
