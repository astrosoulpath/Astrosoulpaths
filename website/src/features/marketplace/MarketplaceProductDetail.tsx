'use client';
import Link from 'next/link';
import {MarketplaceProductImage} from './MarketplaceProductImage';
import {useEffect, useRef, useState} from 'react';
import {marketplaceMoney, marketplaceRequest, type Product} from './marketplace-api';
import s from '../customer-workspace/workspace.module.css';
export function MarketplaceProductDetail({id}: {id:string}) {
  const submitLock=useRef(false);
  const [product, setProduct] = useState<Product | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('');
  useEffect(() => { let active = true; setProduct(null); setError(''); marketplaceRequest<Product>('/marketplace/products/' + encodeURIComponent(id) + '?countryCode=IN').then(r => {if(active)setProduct(r.data);}).catch(() => {if(active)setError('Product unavailable.');}); return () => {active=false;}; }, [id]);
  async function add() {
    if(submitLock.current || !product) return;submitLock.current=true;setBusy(true);setError('');setNotice('');
    try {await marketplaceRequest('/marketplace/customer/cart/items', 'customer', {method:'POST',body:JSON.stringify({productId:id,quantity:1})});setNotice('Added to your cart.');} catch(e) {setError(e instanceof Error ? e.message : 'Unable to update cart.');} finally {submitLock.current=false;setBusy(false);}
  }
  return <main className={s.page}><div className={s.shell}><Link href="/marketplace" className={s.link}>Back to Soul Bazaar</Link>{error && <p role="alert" className={s.error}>{error}</p>}{product ? <section className={s.card}><h1 className="my-6 text-3xl font-semibold">{product.name}</h1><MarketplaceProductImage product={product} large/><p className="whitespace-pre-wrap leading-8">{product.description || product.shortDescription}</p><p className="my-4">{marketplaceMoney(product.displaySellingPrice ?? product.sellingPrice, product.displayCurrency ?? product.currency)}</p><div className={s.actions}><button disabled={busy || product.stock === 0} className={s.button} onClick={add}>{busy ? 'Updating…' : 'Add to cart'}</button><Link href="/marketplace/customer" className={s.link}>Open cart</Link></div><p role="status" className="my-4">{notice}</p><p className={s.muted}>Shipping, taxes and checkout require verified provider configuration. No payment is initiated here.</p></section> : !error && <p role="status">Loading product…</p>}</div></main>;
}
