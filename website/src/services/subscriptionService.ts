const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export type SubscriptionPlanName =
  "DAILY_HOROSCOPE_MONTHLY" | "ASTROLOGER_KUNDLI_YEARLY";

export type SubscriptionStatus =
  | "PENDING"
  | "ACTIVE"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED"
  | "PAUSED"
  | "FREE"
  | "TRIAL";

export type SubscriptionPlan = {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  price: number;
  currency: string;
  durationDays: number;
  features?: Record<string, unknown> | null;
  isActive: boolean;
  isFeatured: boolean;
  razorpayPlanId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionRecord = {
  id: string;
  userId: string;
  subscriptionPlanId?: string | null;
  subscriptionStatus: SubscriptionStatus;
  amount?: number | null;
  currency: string;
  razorpaySubscriptionId?: string | null;
  razorpayCustomerId?: string | null;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  nextBillingAt?: string | null;
  isTrial: boolean;
  cancelledAt?: string | null;
  expiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
  subscriptionPlan?: SubscriptionPlan | null;
};

export type RazorpayOrder = {
  id: string;
  entity?: string;
  amount: number;
  amount_paid?: number;
  amount_due?: number;
  currency: string;
  receipt?: string | null;
  status?: string;
  attempts?: number;
  notes?: Record<string, string>;
  created_at?: number;
};

export type PlansResponse = {
  success: boolean;
  data: SubscriptionPlan[];
};

export type CurrentSubscriptionResponse = {
  success: boolean;
  data: SubscriptionRecord | null;
};

export type CheckoutSubscriptionResponse = {
  success: boolean;
  message?: string;
  data: SubscriptionRecord;
};

export type ReconcilePaymentResponse = {
  success: boolean;
  status: "SUCCESS" | "FAILED" | "PENDING";
  reason?: string;
};

export function requireVerifiedSubscriptionPayment(result: ReconcilePaymentResponse): void {
  if (!result.success || result.status !== "SUCCESS") {
    throw new Error(result.status === "PENDING"
      ? "Payment verification is pending. No subscription access has been confirmed. Check status before retrying checkout."
      : "Payment could not be verified. No subscription access was activated.");
  }
}

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function getAccessToken(): string {
  if (typeof window === "undefined") {
    throw new Error("Subscription actions are only available in the browser.");
  }

  let portal: string | undefined;

  try {
    const storedUserValue = localStorage.getItem("asp_user");

    if (storedUserValue) {
      const storedUser = JSON.parse(storedUserValue) as {
        portal?: string;
      };

      portal = storedUser.portal;
    }
  } catch {
    portal = undefined;
  }

  const portalToken =
    portal === "astrologer"
      ? localStorage.getItem("asp_astrologer_access_token")
      : (localStorage.getItem("asp_customer_access_token") ??
        localStorage.getItem("asp_access_token"));

  const fallbackToken = portalToken;

  if (!fallbackToken) {
    throw new Error("LOGIN_REQUIRED");
  }

  return fallbackToken;
}

export function hasSubscriptionSession(): boolean {
  try { return Boolean(getAccessToken()); } catch { return false; }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const record = data as Record<string, unknown>;

  const message = record.message;

  if (Array.isArray(message)) {
    return message.map(String).join(", ");
  }

  if (typeof message === "string") {
    return message;
  }

  return fallback;
}

async function publicRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(data, "Unable to load subscription plans."),
    );
  }

  return data as T;
}

async function authenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    cache: "no-store",
    credentials: "omit",
    signal: options.signal ?? AbortSignal.timeout(20000),
  });

  const data = await readJson(response);

  if (getAccessToken() !== token) {
    throw new Error("Account changed. Reload payment status for the current account.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("LOGIN_REQUIRED");
    }

    throw new Error(getErrorMessage(data, "Subscription request failed."));
  }

  return data as T;
}

export async function getSubscriptionPlans(): Promise<PlansResponse> {
  return publicRequest<PlansResponse>("/subscription/plans");
}

export async function getCurrentSubscription(): Promise<CurrentSubscriptionResponse> {
  return authenticatedRequest<CurrentSubscriptionResponse>(
    "/subscription/current",
  );
}

/**
 * Development-only legacy checkout.
 * This creates only a PENDING subscription.
 */
export async function checkoutSubscription(
  planName: SubscriptionPlanName,
  autoRenew = false,
): Promise<CheckoutSubscriptionResponse> {
  return authenticatedRequest<CheckoutSubscriptionResponse>(
    "/subscription/checkout",
    {
      method: "POST",
      body: JSON.stringify({
        planName,
        autoRenew,
      }),
    },
  );
}

/**
 * Creates a real Razorpay payment order.
 */
export async function createSubscriptionPaymentOrder(
  planName: SubscriptionPlanName,
): Promise<RazorpayOrder> {
  return authenticatedRequest<RazorpayOrder>(
    "/payments/create-subscription-order",
    {
      method: "POST",
      body: JSON.stringify({
        planName,
      }),
    },
  );
}

/**
 * Re-checks payment status directly from Razorpay.
 */
export async function reconcileSubscriptionPayment(
  razorpayOrderId: string,
): Promise<ReconcilePaymentResponse> {
  const normalizedOrderId = razorpayOrderId.trim();

  if (!normalizedOrderId) {
    throw new Error("Razorpay order ID is required.");
  }

  return authenticatedRequest<ReconcilePaymentResponse>(
    `/payments/reconcile/${encodeURIComponent(normalizedOrderId)}`,
    {
      method: "POST",
    },
  );
}

export async function getPendingSubscriptionPaymentOrder(orderId: string): Promise<RazorpayOrder> {
  if (!/^order_[A-Za-z0-9_]{1,80}$/.test(orderId)) throw new Error("Invalid subscription payment reference.");
  return authenticatedRequest<RazorpayOrder>(`/payments/subscription-order/${encodeURIComponent(orderId)}`, { method: "GET" });
}

export async function getSubscriptionCheckoutConfig(): Promise<{keyId: string; mode: "TEST" | "LIVE"}> {
  const config = await authenticatedRequest<{keyId: string; mode: "TEST" | "LIVE"}>("/payments/checkout-config");
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(config.keyId) ||
      config.mode !== (config.keyId.startsWith("rzp_test_") ? "TEST" : "LIVE")) {
    throw new Error("Checkout environment is unavailable.");
  }
  return config;
}

/** Checkout proof is sent only to the owning backend; never persisted in browser storage. */
export async function verifySubscriptionCheckout(orderId: string, proof: {
  razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string;
}): Promise<ReconcilePaymentResponse> {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || proof.razorpay_order_id !== orderId ||
      !/^pay_[A-Za-z0-9]+$/.test(proof.razorpay_payment_id ?? "") ||
      !/^[a-f0-9]{64}$/i.test(proof.razorpay_signature ?? "")) {
    throw new Error("Invalid checkout proof. Check payment status before retrying.");
  }
  return authenticatedRequest<ReconcilePaymentResponse>("/payments/verify-checkout", {
    method: "POST", body: JSON.stringify({orderId, paymentId: proof.razorpay_payment_id, signature: proof.razorpay_signature}),
  });
}

export async function cancelSubscription(
  cancelAtPeriodEnd = true,
  reason?: string,
): Promise<{
  success: boolean;
  message?: string;
  data: SubscriptionRecord;
}> {
  return authenticatedRequest<{
    success: boolean;
    message?: string;
    data: SubscriptionRecord;
  }>("/subscription/cancel", {
    method: "POST",
    body: JSON.stringify({
      cancelAtPeriodEnd,
      ...(reason?.trim()
        ? {
            reason: reason.trim(),
          }
        : {}),
    }),
  });
}
