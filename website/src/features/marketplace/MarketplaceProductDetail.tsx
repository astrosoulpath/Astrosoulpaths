'use client';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {marketplaceMoney, marketplaceRequest, type Product} from './marketplace-api';
export function MarketplaceProductDetail({id}: {id:string}) {
  const [product, setProduct] = useState<Product | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  useEffect(() => { let active = true; setProduct(null); setError(''); marketplaceRequest<Product>('/marketplace/products/' + encodeURIComponent(id) + '?countryCode=IN').then(r => {if(active)setProduct(r.data);}).catch(() => {if(active)setError('Product unavailable.');}); return () => {active=false;}; }, [id]);
  async function add() {
    if(busy || !product) return; setBusy(true);setError('');setNotice('');
    try {await marketplaceRequest('/marketplace/customer/cart/items', 'customer', {method:'POST',body:JSON.stringify({productId:id,quantity:1})});setNotice('Added to your cart.');} catch(e) {setError(e instanceof Error ? e.message : 'Unable to update cart.');} finally {setBusy(false);}
  }
  return <main className="mx-auto max-w-3xl px-6 py-12 text-[#17213d]"><Link href="/marketplace" className="underline">Back to Soul Bazaar</Link>{error && <p role="alert" className="my-5">{error}</p>}{product ? <><h1 className="my-6 text-3xl font-semibold">{product.name}</h1><p className="whitespace-pre-wrap leading-8">{product.description || product.shortDescription}</p><p className="my-4">{marketplaceMoney(product.displaySellingPrice ?? product.sellingPrice, product.displayCurrency ?? product.currency)}</p><button disabled={busy || product.stock === 0} className="rounded-xl border border-[#a98548] p-4" onClick={add}>{busy ? 'Updating…' : 'Add to cart'}</button><p role="status" className="my-4">{notice}</p><Link href="/marketplace/customer" className="underline">Open cart</Link><p className="mt-6">Shipping, taxes and checkout require verified provider configuration. No payment is initiated here.</p></> : !error && <p role="status">Loading product…</p>}</main>;
}
