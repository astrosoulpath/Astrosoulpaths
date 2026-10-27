import Link from 'next/link';
import {MarketplaceOrders} from '@/features/admin/marketplace/MarketplaceOrders';
export default function MarketplaceOrdersPage() {
  return <main className="asp-admin-page"><Link href="/admin/marketplace" className="asp-admin-back-btn">Back to Soul Bazaar</Link><h1 className="asp-admin-page-title my-6">Marketplace order oversight</h1><section className="asp-admin-panel p-6"><MarketplaceOrders /></section></main>;
}
