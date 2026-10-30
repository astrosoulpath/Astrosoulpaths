'use client';
import Link from 'next/link';
import {MarketplaceProductImage} from './MarketplaceProductImage';
import { useEffect, useState } from 'react';
import { marketplaceMoney, marketplaceRequest, type Product } from './marketplace-api';
import s from '../customer-workspace/workspace.module.css';

export function MarketplaceCatalogue() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{id:string;name:string}[]>([]);
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('');
  const [page, setPage] = useState(1); const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); let active = true;
    setLoading(true); setError(''); setProducts([]);
    const query = new URLSearchParams({search, categoryId:category, page:String(page), limit:'12', countryCode:'IN'});
    Promise.all([marketplaceRequest<Product[]>('/marketplace/products?' + query, undefined, {signal:abort.signal}), marketplaceRequest<{id:string;name:string}[]>('/marketplace/categories', undefined, {signal:abort.signal})])
      .then(([list, groups]) => { if(active) { setProducts(list.data); setMore(list.pagination?.hasMore === true); setCategories(groups.data); } })
      .catch(() => { if(active) setError('Catalogue unavailable. Please retry.'); })
      .finally(() => { if(active) setLoading(false); });
    return () => { active = false; abort.abort(); };
  }, [search, category, page, revision]);
  return <main className={s.page}><div className={s.shell}>
    <p className="text-sm uppercase tracking-widest text-[#82632d]">Soul Bazaar · local preview</p><h1 className="my-4 text-4xl font-semibold">Objects with meaning</h1>
    <p>Approved listings from existing sellers. Paid checkout is not enabled in this website preview.</p>
    <nav className="my-6 flex flex-wrap gap-6"><Link href="/marketplace/customer" className="underline">My cart & orders</Link><Link href="/marketplace/seller" className="underline">Seller workspace</Link></nav>
    <div className="my-8 flex flex-wrap gap-4"><label className={s.field}>Search<input type="search" maxLength={200} value={search} onChange={e => {setSearch(e.target.value);setPage(1);}} /></label><label className={s.field}>Category<select value={category} onChange={e => {setCategory(e.target.value);setPage(1);}}><option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    {loading && <p role="status">Loading catalogue…</p>}{error && <p role="alert">{error} <button className="underline" onClick={() => setRevision(r => r + 1)}>Retry</button></p>}
    {!loading && !error && products.length === 0 && <p>No approved products match these filters.</p>}
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{products.map(product => <article key={product.id} className={s.card}><MarketplaceProductImage product={product} large/><h2 className="text-xl font-semibold"><Link href={'/marketplace/products/' + encodeURIComponent(product.id)} className="underline">{product.name}</Link></h2><p className="my-3">{product.shortDescription}</p><p>{marketplaceMoney(product.displaySellingPrice ?? product.sellingPrice, product.displayCurrency ?? product.currency)}</p><p className="mt-2 text-sm">{typeof product.stock === 'number' ? product.stock > 0 ? 'In stock' : 'Out of stock' : 'Stock status unavailable'}</p></article>)}</div>
    <nav aria-label="Catalogue pagination" className="mt-8 flex gap-6"><button disabled={loading || page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page}</span><button disabled={loading || !more} onClick={() => setPage(p => p + 1)}>Next</button></nav>
  </div></main>;
}
