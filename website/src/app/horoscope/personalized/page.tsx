import type { Metadata } from 'next';
import { HoroscopeShell, PersonalizedHoroscope } from '@/features/horoscope/HoroscopeExperience';
export const metadata: Metadata = {title: 'Your Personalized Horoscope', robots: {index: false, follow: false}, alternates: {canonical: '/horoscope/personalized'}};
export default function Page() { return <HoroscopeShell title="A reading that begins with you" description="Private daily insights from your saved birth profile. Your server checks authentication and active entitlement on every request."><PersonalizedHoroscope/></HoroscopeShell>; }
