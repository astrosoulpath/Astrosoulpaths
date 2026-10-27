"use client";
import { useEffect, useRef, useState } from 'react';
import { customerSession, type JsonRecord } from './horoscope-api';
import { horoscopeCheckout } from './horoscope-payment';
import styles from './horoscope.module.css';

export function HoroscopeCheckout({plan, onVerified}: {plan: JsonRecord; onVerified: () => void}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const work = useRef<AbortController | null>(null);
  useEffect(() => {
    const lifetime = work;
    const fingerprint = () => {try {return customerSession();} catch {return '';}};
    let previous = fingerprint();
    const clear = () => {lifetime.current?.abort(); lifetime.current = null; setBusy(false); setMessage('');};
    window.addEventListener('storage', clear); window.addEventListener('asp-auth-changed', clear);
    const timer = window.setInterval(() => {const next = fingerprint(); if (next !== previous) {previous = next; clear();}}, 1000);
    return () => {clearInterval(timer); lifetime.current?.abort(); lifetime.current = null; window.removeEventListener('storage', clear); window.removeEventListener('asp-auth-changed', clear);};
  }, []);
  async function checkout() {
    if (work.current) return;
    let owner: string;
    try {owner = customerSession();} catch {setMessage('Sign in with your Customer account before checkout.'); return;}
    const controller = new AbortController(); work.current = controller; setBusy(true); setMessage('');
    try {
      const state = await horoscopeCheckout(plan, '', undefined, controller.signal);
      if (controller.signal.aborted || owner !== customerSession()) return;
      if (state === 'VERIFIED') {setMessage('Backend payment verification completed. Refreshing subscription status.'); onVerified();}
      else setMessage(state === 'FAILED' ? 'Payment failed. No access was granted.' : state === 'CANCELLED' ? 'Checkout dismissed. No access was granted.' : 'Payment pending confirmation. Refresh subscription status; do not pay again blindly.');
    } catch {if (!controller.signal.aborted) setMessage('Checkout or verification unavailable. Refresh your subscription status before retrying.');}
    finally {if (work.current === controller) {work.current = null; setBusy(false);}}
  }
  return <><button type="button" className={styles.button} disabled={busy} onClick={() => void checkout()}>{busy ? 'Verifying securely…' : 'Continue with secure Razorpay'}</button>
    {message && <p role="status">{message}</p>}
  </>;
}
