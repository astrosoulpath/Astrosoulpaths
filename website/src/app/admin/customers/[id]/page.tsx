'use client';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {useParams} from 'next/navigation';
import {adminFetch} from '@/features/admin/auth/admin-session';

type Detail = {id:string;email?:string;phone?:string;isActive:boolean;isBlocked:boolean;role?:{name:string};userProfile?:{fullName?:string};wallet?:{balance:string;currency:string};calls?:{id:string;status:string;type?:string;createdAt:string}[]};
export default function CustomerDetailPage() {
  const {id} = useParams<{id:string}>();const [customer,setCustomer] = useState<Detail | null>(null);const [error,setError] = useState('');
  useEffect(()=>{let active=true;setCustomer(null);setError('');const owner=localStorage.getItem('asp_admin_firebase_uid');
    adminFetch('/admin/users/'+encodeURIComponent(id)).then(async response=>{
      const result=await response.json();if(!response.ok || !result.success || result.data?.role?.name?.toUpperCase()!=='CUSTOMER')throw Error('Customer unavailable.');
      if(!owner || owner!==localStorage.getItem('asp_admin_firebase_uid') || !localStorage.getItem('asp_admin_access_token'))throw Error('Admin session changed.');
      if(active)setCustomer(result.data);
    }).catch(()=>{if(active)setError('Customer unavailable or access denied.');});return()=>{active=false;};},[id]);
  return <main><Link href="/admin/customers" className="asp-admin-back-btn">Back to Customers</Link><h1 className="asp-admin-page-title my-6">Customer details</h1>{error && <p role="alert">{error}</p>}{customer ? <>
    <section className="asp-admin-panel p-6"><h2>{customer.userProfile?.fullName || 'Customer'}</h2><p>{customer.email || 'Email unavailable'}</p><p>{customer.phone || 'Phone unavailable'}</p><p>{customer.isBlocked || !customer.isActive ? 'Blocked / inactive' : 'Active'}</p><p>Canonical role: CUSTOMER</p><p>Wallet: {customer.wallet?.currency && /^[A-Z]{3}$/.test(customer.wallet.currency) ? new Intl.NumberFormat('en-IN',{style:'currency',currency:customer.wallet.currency}).format(Number(customer.wallet.balance)) : 'Unavailable'}</p></section>
    <section className="asp-admin-panel mt-6 p-6"><h2 className="text-xl font-semibold">Recent recorded call history</h2>{customer.calls?.length ? customer.calls.map(call=><p className="my-3" key={call.id}>{call.type} · {call.status} · {new Date(call.createdAt).toLocaleDateString()}</p>) : <p>No recent call records.</p>}<p className="mt-4">This endpoint returns a bounded legacy call history; it is not a complete Chat/Audio/Video consultation export.</p></section>
    <p className="mt-5">Birth details, private messages and identity-provider identifiers are not displayed here. Support history and audited account changes require dedicated backend contracts.</p>
  </> : !error && <p role="status">Loading customer…</p>}</main>;
}
