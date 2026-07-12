const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export type SubscriptionPlanName =
  | "DAILY_HOROSCOPE_MONTHLY"
  | "ASTROLOGER_KUNDLI_YEARLY";

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
  status: "SUCCESS" | "FAILED";
  reason?: string;
};

function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return API_BASE_URL.replace(/\/+$/, "");
}

function getAccessToken(): string {
  if (typeof window === "undefined") {
    throw new Error(
      "Subscription actions are only available in the browser.",
    );
  }

  const token = localStorage.getItem(
    "asp_access_token",
  );

  if (!token) {
    throw new Error("LOGIN_REQUIRED");
  }

  return token;
}

async function readJson(
  response: Response,
): Promise<unknown> {
  return response.json().catch(() => null);
}

function getErrorMessage(
  data: unknown,
  fallback: string,
): string {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return fallback;
  }

  const record =
    data as Record<string, unknown>;

  const message = record.message;

  if (Array.isArray(message)) {
    return message
      .map(String)
      .join(", ");
  }

  if (typeof message === "string") {
    return message;
  }

  return fallback;
}

async function publicRequest<T>(
  path: string,
): Promise<T> {
  const response = await fetch(
    `${getApiBaseUrl()}${path}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const data = await readJson(response);

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        data,
        "Unable to load subscription plans.",
      ),
    );
  }

  return data as T;
}

async function authenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  const response = await fetch(
    `${getApiBaseUrl()}${path}`,
    {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    },
  );

  const data = await readJson(response);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("LOGIN_REQUIRED");
    }

    throw new Error(
      getErrorMessage(
        data,
        "Subscription request failed.",
      ),
    );
  }

  return data as T;
}

export async function getSubscriptionPlans(): Promise<PlansResponse> {
  return publicRequest<PlansResponse>(
    "/subscription/plans",
  );
}

export async function getCurrentSubscription(): Promise<CurrentSubscriptionResponse> {
  return authenticatedRequest<CurrentSubscriptionResponse>(
    "/subscription/current",
  );
}

/**
 * Legacy development-only checkout.
 *
 * Ye endpoint sirf PENDING subscription record create karta hai.
 * Real payment ke liye createSubscriptionPaymentOrder use karo.
 */
export async function checkoutSubscription(
  planName: SubscriptionPlanName,
  autoRenew = true,
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
 *
 * Backend:
 * POST /payments/create-subscription-order
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
 * Re-checks Razorpay when:
 * - webhook is late,
 * - browser closes after payment,
 * - network response is lost,
 * - payment popup succeeds but frontend misses callback.
 */
export async function reconcileSubscriptionPayment(
  razorpayOrderId: string,
): Promise<ReconcilePaymentResponse> {
  const normalizedOrderId =
    razorpayOrderId.trim();

  if (!normalizedOrderId) {
    throw new Error(
      "Razorpay order ID is required.",
    );
  }

  return authenticatedRequest<ReconcilePaymentResponse>(
    `/payments/reconcile/${encodeURIComponent(
      normalizedOrderId,
    )}`,
    {
      method: "POST",
    },
  );
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
  }>(
    "/subscription/cancel",
    {
      method: "POST",
      body: JSON.stringify({
        cancelAtPeriodEnd,
        ...(reason?.trim()
          ? {
              reason: reason.trim(),
            }
          : {}),
      }),
    },
  );
}