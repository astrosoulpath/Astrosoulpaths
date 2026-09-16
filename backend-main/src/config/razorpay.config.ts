import Razorpay from 'razorpay';

let razorpayInstance: Razorpay | null = null;

export function getRazorpayInstance(): Razorpay {
  if (razorpayInstance) {
    return razorpayInstance;
  }

  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  if (!keyId || !keySecret) {
    throw new Error(
      'Razorpay configuration is unavailable. RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required.',
    );
  }

  razorpayInstance = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return razorpayInstance;
}
