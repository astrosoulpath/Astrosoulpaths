declare module "react-native-razorpay" {
  export type RazorpaySuccessData = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  export type RazorpayFailureData = {
    code?: number | string;
    description?: string;
    error?: {
      code?: number | string;
      description?: string;
      source?: string;
      step?: string;
      reason?: string;
      metadata?: Record<string, string>;
    };
  };

  export type RazorpayCheckoutOptions = {
    description: string;
    image?: string;
    currency: string;
    key: string;
    amount: number;
    name: string;
    order_id: string;
    prefill?: {
      name?: string;
      email?: string;
      contact?: string;
    };
    notes?: Record<string, string>;
    theme?: {
      color?: string;
    };
    modal?: {
      ondismiss?: () => void;
    };
  };

  const RazorpayCheckout: {
    open(
      options: RazorpayCheckoutOptions,
      successCallback?: (data: RazorpaySuccessData) => void,
      errorCallback?: (error: RazorpayFailureData) => void,
    ): Promise<RazorpaySuccessData>;
    onExternalWalletSelection(
      callback: (data: { external_wallet: string }) => void,
    ): void;
  };

  export default RazorpayCheckout;
}
