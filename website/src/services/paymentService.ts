const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export type PaymentOrderType =
  | "WALLET_RECHARGE"
  | "KUNDLI_REPORT"
  | "SUBSCRIPTION";

export type RazorpayOrderResponse = {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: string;
  attempts: number;
  created_at: number;
  notes?: Record<string, string>;
};

export type CreateWalletRechargeOrderPayload = {
  amount: number;
};

export type CreateKundliReportOrderPayload = {
  amount: number;
  kundliId: string;
  lang?: string;
};

export type CreateSubscriptionOrderPayload = {
  planName:
    | "DAILY_HOROSCOPE_MONTHLY"
    | "ASTROLOGER_KUNDLI_YEARLY"
    | string;
};

export type PaymentReconciliationResponse = {
  success: boolean;
  status: "SUCCESS" | "FAILED";
  reason:
    | "reconciled_from_gateway"
    | "already_processed"
    | "gateway_payment_failed"
    | "amount_mismatch"
    | "currency_mismatch"
    | string;
};

function getApiBaseUrl(): string {
  const baseUrl =
    API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not configured.",
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

function getAccessToken(): string {
  if (typeof window === "undefined") {
    throw new Error(
      "Payment actions are only available in the browser.",
    );
  }

  const token =
    window.localStorage
      .getItem("asp_access_token")
      ?.trim();

  if (!token) {
    throw new Error("LOGIN_REQUIRED");
  }

  return token;
}

async function readJson(
  response: Response,
): Promise<unknown> {
  return response
    .json()
    .catch(() => null);
}

function getErrorMessage(
  value: unknown,
  fallback: string,
): string {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return fallback;
  }

  const record =
    value as Record<string, unknown>;

  const message =
    record.message;

  if (Array.isArray(message)) {
    return message
      .map(String)
      .join(", ");
  }

  if (
    typeof message === "string" &&
    message.trim()
  ) {
    return message.trim();
  }

  const error =
    record.error;

  if (
    typeof error === "string" &&
    error.trim()
  ) {
    return error.trim();
  }

  return fallback;
}

function validateAmount(
  amount: number,
): number {
  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "Amount must be greater than zero.",
    );
  }

  const normalized =
    Number(amount.toFixed(2));

  if (
    normalized !== amount
  ) {
    throw new Error(
      "Amount can have at most two decimal places.",
    );
  }

  return normalized;
}

function normalizeRequiredValue(
  value: string,
  fieldName: string,
): string {
  const normalized =
    value?.trim();

  if (!normalized) {
    throw new Error(
      `${fieldName} is required.`,
    );
  }

  return normalized;
}

async function authenticatedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    getAccessToken();

  const response =
    await fetch(
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

  const data =
    await readJson(response);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error(
        "LOGIN_REQUIRED",
      );
    }

    if (response.status === 403) {
      throw new Error(
        getErrorMessage(
          data,
          "You are not allowed to perform this payment action.",
        ),
      );
    }

    if (response.status === 404) {
      throw new Error(
        getErrorMessage(
          data,
          "Payment resource was not found.",
        ),
      );
    }

    throw new Error(
      getErrorMessage(
        data,
        "Payment request failed.",
      ),
    );
  }

  return data as T;
}

function validateRazorpayOrder(
  value: unknown,
): RazorpayOrderResponse {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
      "Backend returned an invalid payment order.",
    );
  }

  const order =
    value as Partial<RazorpayOrderResponse>;

  if (
    typeof order.id !== "string" ||
    !order.id.trim() ||
    typeof order.amount !== "number" ||
    !Number.isFinite(order.amount) ||
    typeof order.currency !== "string" ||
    !order.currency.trim()
  ) {
    throw new Error(
      "Backend returned an incomplete Razorpay order.",
    );
  }

  return order as RazorpayOrderResponse;
}

export async function createWalletRechargeOrder(
  payload: CreateWalletRechargeOrderPayload,
): Promise<RazorpayOrderResponse> {
  const amount =
    validateAmount(payload.amount);

  const response =
    await authenticatedRequest<unknown>(
      "/payments/create-wallet-recharge-order",
      {
        method: "POST",

        body: JSON.stringify({
          amount,
        }),
      },
    );

  return validateRazorpayOrder(
    response,
  );
}

export async function createLegacyWalletOrder(
  payload: CreateWalletRechargeOrderPayload,
): Promise<RazorpayOrderResponse> {
  const amount =
    validateAmount(payload.amount);

  const response =
    await authenticatedRequest<unknown>(
      "/payments/create-order",
      {
        method: "POST",

        body: JSON.stringify({
          amount,
        }),
      },
    );

  return validateRazorpayOrder(
    response,
  );
}

export async function createKundliReportOrder(
  payload: CreateKundliReportOrderPayload,
): Promise<RazorpayOrderResponse> {
  const amount =
    validateAmount(payload.amount);

  const kundliId =
    normalizeRequiredValue(
      payload.kundliId,
      "Kundli ID",
    );

  const response =
    await authenticatedRequest<unknown>(
      "/payments/create-kundli-report-order",
      {
        method: "POST",

        body: JSON.stringify({
          amount,
          kundliId,
          lang:
            payload.lang?.trim() ||
            "en",
        }),
      },
    );

  return validateRazorpayOrder(
    response,
  );
}

export async function createSubscriptionOrder(
  payload: CreateSubscriptionOrderPayload,
): Promise<RazorpayOrderResponse> {
  const planName =
    normalizeRequiredValue(
      payload.planName,
      "Subscription plan",
    );

  const response =
    await authenticatedRequest<unknown>(
      "/payments/create-subscription-order",
      {
        method: "POST",

        body: JSON.stringify({
          planName,
        }),
      },
    );

  return validateRazorpayOrder(
    response,
  );
}

export async function reconcilePaymentOrder(
  razorpayOrderId: string,
): Promise<PaymentReconciliationResponse> {
  const normalizedOrderId =
    normalizeRequiredValue(
      razorpayOrderId,
      "Razorpay order ID",
    );

  return authenticatedRequest<PaymentReconciliationResponse>(
    `/payments/reconcile/${encodeURIComponent(
      normalizedOrderId,
    )}`,
    {
      method: "POST",
    },
  );
}