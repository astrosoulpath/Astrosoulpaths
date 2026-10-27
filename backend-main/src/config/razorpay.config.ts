import Razorpay from 'razorpay';

let razorpayInstance: Razorpay | null = null;
let configuredKeyId: string | undefined;
let configuredKeySecret: string | undefined;

export function getRazorpayInstance(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay configuration is unavailable. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required.',
    );
  }

  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    throw new Error('Razorpay key mode is invalid.');
  }
  if (keyId.startsWith('rzp_live_') && process.env.RAZORPAY_LIVE_PAYMENTS_ENABLED !== 'true') {
    throw new Error('Razorpay live operations are disabled pending explicit approval.');
  }

  if (razorpayInstance && configuredKeyId === keyId && configuredKeySecret === keySecret) return razorpayInstance;

  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
  configuredKeyId = keyId;
  configuredKeySecret = keySecret;

  return razorpayInstance;
}
