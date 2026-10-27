import type { Metadata } from 'next';
import { FreeHoroscope, HoroscopeShell } from '@/features/horoscope/HoroscopeExperience';
export const metadata: Metadata = {title: 'Free Rashi Horoscope', description: 'General Vedic Moon-sign readings from the Astro Soul Path calculation engine.', alternates: {canonical: '/horoscope/free'}};
export default function Page() { return <HoroscopeShell title="Your Rashi reading" description="General guidance based on Vedic transits. Choose a sign and period to request an authentic backend reading."><FreeHoroscope/></HoroscopeShell>; }
