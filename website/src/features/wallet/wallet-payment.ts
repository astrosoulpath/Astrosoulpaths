import { publicAuthBase, sessionCandidate } from '@/features/auth/public-auth';
import { loadCheckout } from '@/features/horoscope/horoscope-payment';

export type WalletPaymentState = 'SUCCESS' | 'PENDING' | 'FAILED' | 'CANCELLED';
type RecordValue = Record<string, unknown>;
type Proof = { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
type Options = {key: string; order_id: string; amount: number; currency: string; name: string; description: string;
  handler: (proof: Proof) => Promise<void>; modal: {ondismiss: () => void}; theme: {color: string}};
type Provider = new (options: Options) => {open(): void; close(): void; on(event: string, fn: () => void): void};
const locks = new Set<string>();
const object = (v: unknown): RecordValue => v && typeof v === 'object' && !Array.isArray(v) ? v as RecordValue : {};

/** Local metadata only fences responses; the server authorizes every request. */
export async function walletPayment(action: 'checkout' | 'status', amount: number, signal: AbortSignal,
  load: () => Promise<unknown> = loadCheckout): Promise<WalletPaymentState> {
  const owner = sessionCandidate('/wallet');
  if (!owner || owner.portal !== 'customer') throw Error('Sign in with your Customer account.');
  const base = publicAuthBase();
  const lock = base + owner.snapshot;
  if (locks.has(lock)) throw Error('A wallet payment request is already in progress.');
  locks.add(lock);
  const assertOwner = () => {
    if (signal.aborted || sessionCandidate('/wallet')?.snapshot !== owner.snapshot)
      throw Error('Account changed or checkout closed. Check payment status when you return.');
  };
  async function request(path: string, body?: RecordValue) {
    assertOwner();
    const response = await fetch(base + path, {method: body ? 'POST' : 'GET',
      headers: {Authorization: 'Bearer ' + owner!.token, 'Content-Type': 'application/json'},
      body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(20000)])});
    const value = object(await response.json().catch(() => null)); assertOwner();
    if (!response.ok) throw Error(response.status === 401 ? 'Sign in again before checking payment status.' : 'Payment request was not confirmed. Check status before retrying.');
    return value;
  }
  try {
    const session = await request('/user/session?portal=customer');
    const user = object(session.user);
    if (session.portal !== 'customer' || session.role !== 'CUSTOMER' || user.portal !== 'customer' || typeof user.id !== 'string')
      throw Error('Verified Customer access is required.');
    const storageKey = 'asp_wallet_pending_v1:' + encodeURIComponent(base) + ':' + user.id;
    const stored = localStorage.getItem(storageKey);
    if (stored && !/^order_[A-Za-z0-9]+$/.test(stored))
      throw Error('An earlier order request has an uncertain outcome. Review payment history before creating another order.');
    const interpret = (v: RecordValue): WalletPaymentState => v.success === true && v.status === 'SUCCESS' ? 'SUCCESS' : v.success === true && v.status === 'FAILED' ? 'FAILED' : 'PENDING';
    const settle = (v: RecordValue) => {
      const state = interpret(v);
      if (state === 'SUCCESS' || state === 'FAILED') localStorage.removeItem(storageKey);
      return state;
    };
    if (action === 'status') {
      if (!stored) throw Error('No pending wallet checkout for this account. Review wallet history.');
      return settle(await request('/payments/reconcile/' + stored, {}));
    }
    if (!Number.isFinite(amount) || amount < 50 || amount > 50000 || Math.round(amount * 100) / 100 !== amount)
      throw Error('Enter INR50–50,000 with at most two decimal places.');
    const config = await request('/payments/checkout-config');
    if (typeof config.keyId !== 'string' || !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(config.keyId) ||
        config.mode !== (config.keyId.startsWith('rzp_test_') ? 'TEST' : 'LIVE'))
      throw Error('Checkout environment is unavailable. No order was requested.');
    const Constructor = await load() as Provider; assertOwner();
    if (!stored) {
      if (localStorage.getItem(storageKey)) throw Error('Another wallet request is pending. Check status first.');
      localStorage.setItem(storageKey, 'CREATING'); // Persist uncertain outcomes; never auto-create a second order.
    }
    const order = stored ? await request('/payments/wallet-order/' + stored) : await request('/payments/create-wallet-recharge-order', {amount});
    if (typeof order.id !== 'string' || !/^order_[A-Za-z0-9]+$/.test(order.id)) throw Error('Invalid order. Review payment history.');
    localStorage.setItem(storageKey, order.id);
    if (order.currency !== 'INR' || !Number.isSafeInteger(order.amount) || Number(order.amount) < 5000 ||
        (!stored && order.amount !== Math.round(amount * 100))) throw Error('Order amount or currency mismatch. Check status.');
    const currentConfig = await request('/payments/checkout-config');
    if (currentConfig.keyId !== config.keyId || currentConfig.mode !== config.mode)
      throw Error('Payment environment changed. Check order status before checkout.');
    return await new Promise<WalletPaymentState>((resolve, reject) => {
      let finished = false, verifying = false;
      const finish = (state?: WalletPaymentState, error?: Error) => {
        if (finished) return; finished = true; signal.removeEventListener('abort', abort);
        window.removeEventListener('asp-auth-changed', changed); window.removeEventListener('storage', changed);
        if (error) reject(error); else resolve(state ?? 'PENDING');
      };
      const abort = () => {finish(undefined, Error('Checkout closed. Check payment status before retrying.')); instance?.close();};
      const changed = () => {try {assertOwner();} catch {abort();}};
      const instance = new Constructor({key: config.keyId as string, order_id: order.id as string, amount: Number(order.amount), currency: 'INR',
        name: 'Astro Soul Path', description: 'Wallet recharge', theme: {color: '#D4AF37'},
        handler: async proof => {
          if (finished || verifying) return; verifying = true;
          try {
            assertOwner();
            if (proof.razorpay_order_id !== order.id || !/^pay_[A-Za-z0-9]+$/.test(proof.razorpay_payment_id ?? '') ||
                !/^[a-f0-9]{64}$/i.test(proof.razorpay_signature ?? '')) throw Error('Invalid checkout proof. Check payment status.');
            const verified = await request('/payments/verify-checkout', {orderId: order.id, paymentId: proof.razorpay_payment_id, signature: proof.razorpay_signature});
            if (!finished) finish(settle(verified));
          } catch {finish(undefined, Error('Payment verification was not confirmed. Check status before retrying; do not pay again.'));}
        }, modal: {ondismiss: () => {if (!verifying) finish('CANCELLED');}},
      });
      instance.on('payment.failed', () => {if (!verifying) finish('FAILED');});
      signal.addEventListener('abort', abort, {once: true});
      window.addEventListener('asp-auth-changed', changed); window.addEventListener('storage', changed);
      try {assertOwner(); instance.open();} catch {abort();}
    });
  } finally {locks.delete(lock);}
}
