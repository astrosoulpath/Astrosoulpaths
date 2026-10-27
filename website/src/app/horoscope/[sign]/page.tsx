import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FreeHoroscope, HoroscopeShell } from '@/features/horoscope/HoroscopeExperience';
import { SIGNS } from '@/features/horoscope/horoscope-api';
type Props = {params: Promise<{sign: string}>};
export function generateStaticParams() { return SIGNS.map(([sign]) => ({sign})); }
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {sign} = await params; const selected = SIGNS.find(item => item[0] === sign);
  if (!selected) return {title: 'Horoscope not found', robots: {index: false}};
  return {title: `${selected[1]} Rashi Horoscope`, description: `Free ${selected[1]} Moon-sign guidance for daily, weekly, monthly and yearly periods.`, alternates: {canonical: `/horoscope/${sign}`}};
}
export default async function Page({params}: Props) {
  const {sign} = await params; const selected = SIGNS.find(item => item[0] === sign); if (!selected) notFound();
  return <HoroscopeShell title={`${selected[1]} · Vedic Moon sign`} description="Explore the periods supported by our shared backend. Your Rashi reading is general guidance, separate from a personalized birth-chart reading."><FreeHoroscope initialSign={sign}/></HoroscopeShell>;
}
