import { MarketplaceProductDetail } from '@/features/marketplace/MarketplaceProductDetail';
export default async function ProductPage({params}: {params: Promise<{id:string}>}) {
  const {id} = await params; return <MarketplaceProductDetail id={id} />;
}
