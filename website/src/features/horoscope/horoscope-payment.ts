import { createSubscriptionPaymentOrder, getSubscriptionCheckoutConfig, verifySubscriptionCheckout } from '@/services/subscriptionService';
import { customerSession, isDailyOffer, type JsonRecord } from './horoscope-api';

export type CheckoutState = 'PENDING' | 'VERIFIED' | 'FAILED' | 'CANCELLED';
type Options = {key: string; amount: number; currency: string; name: string; description: string; order_id: string; handler: (result: {razorpay_order_id: string; razorpay_payment_id?: string; razorpay_signature?: string}) => Promise<void>; modal: {ondismiss: () => void}; theme: {color: string}};
type Checkout = {open: () => void; close: () => void; on: (event: 'payment.failed', callback: () => void) => void};
type Constructor = new (options: Options) => Checkout;
let sdk: Promise<Constructor> | null = null;
async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {return await Promise.race([operation, new Promise<never>((_resolve, reject) => {timer = setTimeout(() => reject(new Error('Payment request timed out. Refresh status before retrying.')), 30000);})]);}
  finally {clearTimeout(timer!);}
}
export function loadCheckout(): Promise<Constructor> {
  if (window.Razorpay) return Promise.resolve(window.Razorpay as Constructor);
  if (sdk) return sdk;
  sdk = new Promise<Constructor>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    const script = existing ?? document.createElement('script');
    const timer = window.setTimeout(() => done(false), 15000);
    function done(ok: boolean) {
      clearTimeout(timer); script.removeEventListener('load', loaded); script.removeEventListener('error', failed);
      if (ok && window.Razorpay) resolve(window.Razorpay as Constructor);
      else {sdk = null; if (!existing) script.remove(); reject(new Error('Secure checkout could not load.'));}
    }
    function loaded() {done(true);}
    function failed() {done(false);}
    script.addEventListener('load', loaded, {once: true}); script.addEventListener('error', failed, {once: true});
    if (!existing) {script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true; document.body.appendChild(script);}
  });
  return sdk;
}

/** The backend supplies the public key and enforces its default-off LIVE gate. */
export async function horoscopeCheckout(plan: JsonRecord, key: string, load = loadCheckout, signal?: AbortSignal): Promise<CheckoutState> {
  if (!isDailyOffer(plan)) throw new Error('An authoritative daily horoscope offer is required.');
  const owner = customerSession();
  function assertOwner() {if (signal?.aborted || customerSession() !== owner) throw new Error('Account changed or checkout closed. Refresh status before retrying.');}
  const config = await bounded(getSubscriptionCheckoutConfig()); assertOwner();
  if (key && key !== config.keyId) throw new Error('Checkout environment changed. Refresh before retrying.');
  const Provider = await load(); assertOwner();
  const order = await bounded(createSubscriptionPaymentOrder('DAILY_HOROSCOPE_MONTHLY')); assertOwner();
  if (!order.id || order.currency !== plan.currency || order.amount !== Number(plan.price) * 100) throw new Error('Checkout order does not match the authoritative offer. No checkout opened.');
  const latest = await bounded(getSubscriptionCheckoutConfig()); assertOwner();
  if (latest.keyId !== config.keyId || latest.mode !== config.mode) throw new Error('Checkout environment changed. Check status before retrying.');
  return new Promise<CheckoutState>((resolve, reject) => {
    let finished = false, verifying = false;
    const finish = (state?: CheckoutState, error?: Error) => {
      if (finished) return; finished = true; signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(state ?? 'PENDING');
    };
    const abort = () => {finish(undefined, new Error('Checkout closed. Refresh status before retrying.')); instance?.close();};
    const instance = new Provider({key: config.keyId, amount: order.amount, currency: order.currency, name: 'Astro Soul Path', description: 'Personalized Daily Horoscope', order_id: order.id, theme: {color: '#5b3475'},
      handler: async result => {
        if (finished || verifying) return; verifying = true;
        try {
          assertOwner();
          if (result.razorpay_order_id !== order.id) throw new Error('Payment order mismatch. Refresh status.');
          const verification = await bounded(verifySubscriptionCheckout(order.id, result)); assertOwner();
          finish(verification.success && verification.status === 'SUCCESS' ? 'VERIFIED' : verification.status === 'FAILED' ? 'FAILED' : 'PENDING');
        } catch {finish(undefined, new Error('Payment verification was not confirmed. Refresh status before retrying.'));}
      }, modal: {ondismiss: () => {if (!verifying) finish('CANCELLED');}},
    });
    instance.on('payment.failed', () => finish('FAILED'));
    signal?.addEventListener('abort', abort, {once: true});
    try {assertOwner(); instance.open();} catch {abort();}
  });
}
