import Link from 'next/link';
import {MarketplaceFinance} from '@/features/admin/marketplace/MarketplaceFinance';
export default function MarketplaceFinancePage() {
  return <main className="asp-admin-page"><Link href="/admin/marketplace" className="asp-admin-back-btn">Back to Soul Bazaar</Link><h1 className="asp-admin-page-title my-6">Marketplace recorded finance</h1><section className="asp-admin-panel p-6"><MarketplaceFinance /></section></main>;
}
