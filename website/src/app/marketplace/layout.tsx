import { notFound } from 'next/navigation';
import { publicHomepageAllowed } from '@/features/home/public-launch';
export const dynamic = 'force-dynamic';
export const metadata = {title: 'Soul Bazaar preview', robots: {index: false, follow: false}};
export default function MarketplaceLayout({children}: {children: React.ReactNode}) {
  if (!publicHomepageAllowed()) notFound();
  return children;
}
