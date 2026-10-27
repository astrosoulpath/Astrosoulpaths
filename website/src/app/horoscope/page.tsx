import type { Metadata } from 'next';
import Link from 'next/link';
import { HoroscopeShell, ZodiacGrid } from '@/features/horoscope/HoroscopeExperience';
import styles from '@/features/horoscope/horoscope.module.css';
export const metadata: Metadata = {title: 'Vedic Horoscope', description: 'Explore free Moon-sign readings and your private personalized daily horoscope.', alternates: {canonical: '/horoscope'}};
export default function HoroscopeEntry() {
  return <HoroscopeShell title="A little cosmic perspective. A clearer day." description="Explore general Rashi guidance, or open a personalized daily reading grounded in your saved birth profile and the shared Vedic engine.">
    <div className={styles.grid}>
      <section className={styles.card}><h2>Your Rashi, your rhythm</h2><p>Free general guidance for daily, weekly, monthly and yearly periods. Select your Vedic Moon sign below.</p><Link className={styles.button} href="/horoscope/free">Explore free horoscope</Link></section>
      <section className={styles.card}><h2>Made for your birth chart</h2><p>Your private daily reading uses your existing account, birth profile and active entitlement. No separate account or calculation engine.</p><Link className={styles.button} href="/horoscope/personalized">Open personalized horoscope</Link></section>
    </div>
    <h2 className="mb-4 text-2xl font-semibold">Choose your Moon sign / Rashi</h2><ZodiacGrid/>
  </HoroscopeShell>;
}
