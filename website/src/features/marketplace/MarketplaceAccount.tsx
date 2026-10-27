'use client';
import Link from 'next/link';
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {marketplaceMoney, marketplaceRequest, type Portal, type Product} from './marketplace-api';

type Order = {id:string;orderNumber?:string;status:string;currency?:string;grandTotal?:string;trackingNumber?:string;courierName?:string;trackingUrl?:string};
type Address = {id:string;fullName:string;addressLine1:string;city:string;postalCode:string};
type Cart = {items?:{id:string;quantity:number;product?:Product}[]};
type Earning = {id:string;currency:string;grossAmount:string;platformFeeAmount:string;netAmount:string;status:string};

export function MarketplaceAccount({portal}: {portal:Portal}) {
  const [orders, setOrders] = useState<Order[]>([]); const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart | null>(null); const [addresses, setAddresses] = useState<Address[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]); const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [loaded, setLoaded] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(''); const [categories,setCategories]=useState<{id:string;name:string}[]>([]); const generation = useRef(0);
  function clear() {setOrders([]);setProducts([]);setCart(null);setAddresses([]);setEarnings([]);setSelectedAddress('');setLoaded(false);}
  useEffect(() => { const lifetime = generation; const invalidate = () => {generation.current++;clear();setBusy(false);setLoading(false);setError('');}; window.addEventListener('storage',invalidate);window.addEventListener('asp-auth-changed',invalidate);return () => {lifetime.current++;window.removeEventListener('storage',invalidate);window.removeEventListener('asp-auth-changed',invalidate);}; }, []);
  async function load() {
    const version = ++generation.current; clear();setLoading(true);setError('');
    try {
      const orderData = await marketplaceRequest<Order[]>(`/marketplace/${portal}/orders`,portal);
      if(version !== generation.current)return; setOrders(orderData.data);
      if(portal === 'customer') {
        const [cartData,addressData] = await Promise.all([marketplaceRequest<Cart>('/marketplace/customer/cart',portal),marketplaceRequest<Address[]>('/marketplace/customer/addresses',portal)]);
        if(version !== generation.current)return;setCart(cartData.data);setAddresses(addressData.data);
      } else {
        const [productData, earningData, categoryData] = await Promise.all([marketplaceRequest<Product[]>('/marketplace/seller/products',portal),marketplaceRequest<{earnings:Earning[]}>('/marketplace/seller/earnings',portal),marketplaceRequest<{id:string;name:string}[]>('/marketplace/categories')]);
        if(version !== generation.current)return;setProducts(productData.data);setEarnings(earningData.data.earnings);setCategories(categoryData.data);
      }
      setLoaded(true);
    } catch(e) {if(version === generation.current){clear();setError(e instanceof Error ? e.message : 'Unable to load workspace.');}}
    finally {if(version === generation.current){setLoading(false);setBusy(false);}}
  }
  async function mutate(path:string, method:string, body?:unknown) {
    if(busy)return;const version=generation.current;setBusy(true);setError('');
    try {await marketplaceRequest(path,portal,{method,...(body === undefined ? {} : {body:JSON.stringify(body)})});if(version===generation.current)await load();}
    catch(e){if(version===generation.current)setError(e instanceof Error ? e.message : 'Change could not be confirmed. Refresh before retrying.');}
    finally{if(version===generation.current)setBusy(false);}
  }
  async function createProduct(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=new FormData(event.currentTarget);
    await mutate('/marketplace/seller/products','POST',{name:data.get('name'),sku:data.get('sku'),categoryId:data.get('categoryId'),description:data.get('description'),mrp:Number(data.get('mrp')),sellingPrice:Number(data.get('sellingPrice')),stock:Number(data.get('stock'))});
  }
  async function createAddress(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));
    await mutate('/marketplace/customer/addresses','POST',{...data,country:'India',countryCode:'IN'});
  }
  async function upload(productId:string, file:File | undefined) {
    if(!file || busy)return;
    if(file.size>8*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)){setError('Choose a JPEG, PNG or WebP image up to 8 MB.');return;}
    const version=generation.current;const data=new FormData();data.set('file',file);setBusy(true);setError('');
    try{await marketplaceRequest('/marketplace/seller/products/'+encodeURIComponent(productId)+'/images',portal,{method:'POST',body:data});if(version===generation.current)await load();}
    catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Image upload could not be confirmed.');}finally{if(version===generation.current)setBusy(false);}
  }
  const fieldLabel:Record<string,string>={fullName:'Full name',phone:'Phone',addressLine1:'Address line',city:'City',state:'State',postalCode:'Delivery PIN code',name:'Product name',sku:'SKU',description:'Description',mrp:'MRP',sellingPrice:'Selling price',stock:'Stock quantity'};
  const button='rounded-xl border border-[#ac905a] px-4 py-3 disabled:opacity-50';
  return <main className="mx-auto max-w-6xl px-6 py-12 text-[#17213d]">
    <Link href="/marketplace" className="underline">Back to Soul Bazaar</Link><h1 className="my-5 text-3xl font-semibold">{portal === 'seller' ? 'Seller workspace' : 'My cart & orders'}</h1>
    <p>Access is decided by the backend using your existing {portal === 'seller' ? 'approved Astrologer seller' : 'Customer'} session.</p>
    <p className="my-3">Checkout, provider refunds and payouts remain disabled in this website preview. Refresh after uncertain changes; do not automatically resubmit.</p>
    <Link href={portal === 'seller' ? '/astrologer/login' : '/login'} className="mr-6 underline">Sign in normally</Link><button onClick={load} disabled={loading || busy} className={button}>{loading ? 'Loading…' : 'Load / refresh my records'}</button>
    {error && <p role="alert" className="my-5">{error}</p>}
    {loaded && <>
      {portal === 'customer' && <section className="my-8 rounded-2xl border p-6"><h2 className="text-2xl font-semibold">Cart & delivery address</h2>{!cart?.items?.length && <p className="my-4">Your cart is empty.</p>}{cart?.items?.map(item => <div key={item.id} className="my-5 flex flex-wrap items-center gap-4"><span>{item.product?.name || 'Product'} · Quantity {item.quantity}</span><button disabled={busy} className={button} onClick={() => mutate('/marketplace/customer/cart/items/'+encodeURIComponent(item.id),'DELETE')}>Remove</button></div>)}
        <label className="block my-4">Choose an owned address<select className="ml-3 rounded border p-3" value={selectedAddress} onChange={e=>setSelectedAddress(e.target.value)}><option value="">Select explicitly</option>{addresses.map(a=><option key={a.id} value={a.id}>{a.fullName} · {a.city} · {a.postalCode}</option>)}</select></label>
        <details><summary className="cursor-pointer font-semibold">Add an India delivery address</summary><form onSubmit={createAddress} className="my-5 grid gap-4 sm:grid-cols-2">{['fullName','phone','addressLine1','city','state','postalCode'].map(field=><label key={field}>{fieldLabel[field] || field}<input className="block w-full rounded border p-3" name={field} required maxLength={field==='addressLine1'?250:120} /></label>)}<button className={button} disabled={busy}>Save owned address</button></form></details>
        <p className="mt-4">A verified shipping/tax quote is required before order preparation. No provisional rate is charged.</p><button className={button} disabled>Checkout unavailable</button>
      </section>}
      {portal === 'seller' && <>
        <section className="my-8 rounded-2xl border p-6"><h2 className="text-2xl font-semibold">Your products & inventory</h2>{products.length===0 && <p className="my-4">No products found.</p>}{products.map(product=><article key={product.id} className="my-6 border-b pb-6"><h3 className="text-lg font-semibold">{product.name}</h3><p>{product.status} · Recorded stock {product.stock ?? 'Unavailable'}</p><details className="my-4"><summary className="cursor-pointer">Edit product details</summary><form className="my-3 grid gap-3" onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);void mutate('/marketplace/seller/products/'+encodeURIComponent(product.id),'PATCH',{name:data.get('name'),shortDescription:data.get('shortDescription')});}}><label>Product name<input name="name" required maxLength={200} defaultValue={product.name} className="ml-3 rounded border p-3" /></label><label>Short description<input name="shortDescription" maxLength={500} defaultValue={product.shortDescription || ''} className="ml-3 rounded border p-3" /></label><button className={button} disabled={busy}>Save draft changes</button></form><label>Upload product image (JPEG, PNG or WebP, up to 8 MB)<input className="my-3 block" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event=>{void upload(product.id,event.target.files?.[0]);event.target.value='';}} /></label></details><form className="my-3 flex flex-wrap gap-3" onSubmit={e=>{e.preventDefault();const stock=Number(new FormData(e.currentTarget).get('stock'));void mutate('/marketplace/seller/products/'+encodeURIComponent(product.id)+'/inventory','PATCH',{expectedStock:product.stock,stock});}}><label>New stock<input className="ml-2 w-24 rounded border p-2" name="stock" type="number" min="0" step="1" required /></label><button className={button} disabled={busy || typeof product.stock!=='number'}>Update inventory</button></form><button className={button} disabled={busy} onClick={()=>mutate('/marketplace/seller/products/'+encodeURIComponent(product.id)+'/submit','POST')}>Submit for approval</button></article>)}
          <details><summary className="cursor-pointer font-semibold">Create product draft</summary><form onSubmit={createProduct} className="mt-5 grid gap-4 sm:grid-cols-2">{['name','sku','description','mrp','sellingPrice','stock'].map(field=><label key={field}>{fieldLabel[field] || field}<input className="block w-full rounded border p-3" name={field} required type={['mrp','sellingPrice','stock'].includes(field)?'number':'text'} min={field==='stock'?0:.01} step={field==='stock'?1:.01} /></label>)}<label>Category<select name="categoryId" required className="block w-full rounded border p-3" defaultValue=""><option value="" disabled>Choose a verified category</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button className={button} disabled={busy}>Create draft</button></form></details>
        </section>
        <section className="my-8"><h2 className="text-2xl font-semibold">Recorded seller earnings</h2><p className="my-3">The backend records the 70% seller / 30% platform allocation. Shipping, taxes and fees are not inferred here.</p>{earnings.length===0 && <p>No recorded earnings.</p>}{earnings.map(e=><p key={e.id} className="my-4">{e.status} · Gross {marketplaceMoney(e.grossAmount,e.currency)} · Platform {marketplaceMoney(e.platformFeeAmount,e.currency)} · Seller {marketplaceMoney(e.netAmount,e.currency)}</p>)}</section>
      </>}
      <section className="my-8"><h2 className="text-2xl font-semibold">Order history</h2>{orders.length===0 && <p className="my-4">No orders found.</p>}{orders.map(order=><article key={order.id} className="my-4 rounded-xl border p-5"><h3>{order.orderNumber || order.id}</h3><p>{order.status} · {marketplaceMoney(order.grandTotal,order.currency)}</p>{order.trackingNumber && <p>Tracking: {order.courierName} · {order.trackingNumber}</p>}<p className="mt-3">Cancellation/refund eligibility requires the existing backend case workflow. Provider refunds are not initiated here.</p></article>)}</section>
    </>}
  </main>;
}
