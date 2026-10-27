import Link from "next/link";
import { SolarSystem } from "./SolarSystem";
import s from "./cinematic-home.module.css";
export function HeroSection() {
 return <section className={s.hero} aria-labelledby="hero-heading"><div className={s.heroInner}><div className={s.heroCopy}>
 <p className={s.eyebrow}>Ancient wisdom. A new perspective.</p><h1 id="hero-heading">Discover clarity in every <em>cosmic moment.</em></h1>
 <p className={s.lede}>Explore Vedic wisdom, connect with verified astrologers, and find a thoughtful perspective for life’s most meaningful journeys.</p>
 <div className={s.actions}><Link className={s.goldButton} href="/astrologers">Talk to an Astrologer <span aria-hidden="true">↗</span></Link><Link className={s.outlineButton} href="/kundli">Explore Your Kundli</Link></div><p className={s.heroNote}>Your pace. Your questions. Your path.</p></div><SolarSystem /></div>
 <div className={s.heroFoot}><span>Vedic astrology, thoughtfully explored</span><a href="#discover">Discover your path <span aria-hidden="true">↓</span></a></div></section>;
}
