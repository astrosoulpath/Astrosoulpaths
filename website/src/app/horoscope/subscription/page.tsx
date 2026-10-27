import type { Metadata } from 'next';
import { HoroscopeShell, HoroscopeSubscription } from '@/features/horoscope/HoroscopeExperience';
export const metadata: Metadata = {title: 'Horoscope Subscription & Reminders', robots: {index: false, follow: false}, alternates: {canonical: '/horoscope/subscription'}};
export default function Page() { return <HoroscopeShell title="Your daily guidance, thoughtfully managed" description="Review the authoritative plan, subscription status and explicit reminder consent. Payment and entitlement remain controlled by the shared backend."><HoroscopeSubscription/></HoroscopeShell>; }
