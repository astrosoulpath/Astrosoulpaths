"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cancelSubscription,
  createSubscriptionPaymentOrder,
  getCurrentSubscription,
  getSubscriptionPlans,
  reconcileSubscriptionPayment,
  type RazorpayOrder,
  type SubscriptionPlan,
  type SubscriptionPlanName,
  type SubscriptionRecord,
} from "@/services/subscriptionService";

const REQUIRED_PLAN_NAMES: SubscriptionPlanName[] = [
  "DAILY_HOROSCOPE_MONTHLY",
  "ASTROLOGER_KUNDLI_YEARLY",
];

type RazorpaySuccessResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayFailureResponse = {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (
    response: RazorpaySuccessResponse,
  ) => void | Promise<void>;
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
    confirm_close?: boolean;
    escape?: boolean;
  };
};

type RazorpayInstance = {
  open: () => void;
  close: () => void;
  on: (
    eventName: "payment.failed",
    callback: (
      response: RazorpayFailureResponse,
    ) => void,
  ) => void;
};

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayOptions,
    ) => RazorpayInstance;
  }
}

function formatPrice(
  plan: SubscriptionPlan,
): string {
  try {
    return new Intl.NumberFormat(
      plan.currency === "USD"
        ? "en-US"
        : "en-IN",
      {
        style: "currency",
        currency: plan.currency,
        maximumFractionDigits:
          plan.currency === "USD" ? 2 : 0,
      },
    ).format(plan.price);
  } catch {
    return `${plan.currency} ${plan.price}`;
  }
}

function formatSubscriptionAmount(
  subscription: SubscriptionRecord,
): string {
  const amount = Number(
    subscription.amount ?? 0,
  );

  try {
    return new Intl.NumberFormat(
      subscription.currency === "USD"
        ? "en-US"
        : "en-IN",
      {
        style: "currency",
        currency: subscription.currency,
        maximumFractionDigits:
          subscription.currency === "USD"
            ? 2
            : 0,
      },
    ).format(
      Number.isFinite(amount) ? amount : 0,
    );
  } catch {
    return `${subscription.currency} ${
      Number.isFinite(amount) ? amount : 0
    }`;
  }
}

function formatDate(
  value?: string | null,
): string {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getBillingLabel(
  plan: SubscriptionPlan,
): string {
  if (
    plan.name ===
    "DAILY_HOROSCOPE_MONTHLY"
  ) {
    return "/ month";
  }

  if (
    plan.name ===
    "ASTROLOGER_KUNDLI_YEARLY"
  ) {
    return "/ year";
  }

  return `for ${plan.durationDays} days`;
}

function getAudienceLabel(
  plan: SubscriptionPlan,
): string {
  if (
    plan.name ===
    "DAILY_HOROSCOPE_MONTHLY"
  ) {
    return "For Customers";
  }

  if (
    plan.name ===
    "ASTROLOGER_KUNDLI_YEARLY"
  ) {
    return "For Astrologers";
  }

  return "Subscription Plan";
}

function getFeatureList(
  plan: SubscriptionPlan,
): string[] {
  if (
    plan.name ===
    "DAILY_HOROSCOPE_MONTHLY"
  ) {
    return [
      "Personalized Vedic daily reading",
      "Daily advice and mood",
      "Focus area of the day",
      "Lucky color and lucky number",
      "Favorable activities",
      "In-app daily horoscope",
      "Monthly subscription access",
    ];
  }

  if (
    plan.name ===
    "ASTROLOGER_KUNDLI_YEARLY"
  ) {
    return [
      "Unlimited Kundli generation",
      "Save customer charts",
      "Birth Chart (D1)",
      "Navamsa Chart (D9)",
      "Basic Dasha analysis",
      "Dosha analysis",
      "Download and print PDF reports",
      "Annual professional access",
    ];
  }

  return [];
}

function getStatusClasses(
  status?: string,
): string {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";

    case "PENDING":
      return "bg-yellow-100 text-yellow-700";

    case "CANCELLED":
      return "bg-gray-100 text-gray-700";

    case "FAILED":
    case "EXPIRED":
      return "bg-red-100 text-red-700";

    case "TRIAL":
      return "bg-blue-100 text-blue-700";

    case "PAUSED":
      return "bg-orange-100 text-orange-700";

    default:
      return "bg-gray-100 text-gray-600";
  }
}

function readStoredUser(): {
  name?: string;
  email?: string;
  phone?: string;
} {
  if (typeof window === "undefined") {
    return {};
  }

  const storedUser =
    localStorage.getItem("asp_user");

  if (!storedUser) {
    return {};
  }

  try {
    const parsed = JSON.parse(
      storedUser,
    ) as Record<string, unknown>;

    return {
      name:
        typeof parsed.name === "string"
          ? parsed.name
          : undefined,
      email:
        typeof parsed.email === "string"
          ? parsed.email
          : undefined,
      phone:
        typeof parsed.phone === "string"
          ? parsed.phone
          : undefined,
    };
  } catch {
    return {};
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (
      typeof window !== "undefined" &&
      window.Razorpay
    ) {
      resolve(true);
      return;
    }

    const existingScript =
      document.querySelector<HTMLScriptElement>(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
      );

    if (existingScript) {
      existingScript.addEventListener(
        "load",
        () => resolve(true),
        {
          once: true,
        },
      );

      existingScript.addEventListener(
        "error",
        () => resolve(false),
        {
          once: true,
        },
      );

      return;
    }

    const script =
      document.createElement("script");

    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";

    script.async = true;

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

export default function SubscriptionsPage() {
  const router = useRouter();

  const [plans, setPlans] = useState<
    SubscriptionPlan[]
  >([]);

  const [
    currentSubscription,
    setCurrentSubscription,
  ] =
    useState<SubscriptionRecord | null>(
      null,
    );

  const [loadingPlans, setLoadingPlans] =
    useState(true);

  const [
    loadingCurrent,
    setLoadingCurrent,
  ] = useState(true);

  const [
    processingPlan,
    setProcessingPlan,
  ] =
    useState<SubscriptionPlanName | null>(
      null,
    );

  const [cancelling, setCancelling] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    paymentMessage,
    setPaymentMessage,
  ] = useState("");

  const [isLoggedIn, setIsLoggedIn] =
    useState(false);

  const razorpayKeyId =
    process.env
      .NEXT_PUBLIC_RAZORPAY_KEY_ID;

  const loadPlans =
    useCallback(async () => {
      try {
        setLoadingPlans(true);
        setError("");

        const response =
          await getSubscriptionPlans();

        const requiredPlans =
          response.data.filter((plan) =>
            REQUIRED_PLAN_NAMES.includes(
              plan.name as SubscriptionPlanName,
            ),
          );

        setPlans(requiredPlans);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load subscription plans.",
        );
      } finally {
        setLoadingPlans(false);
      }
    }, []);

  const loadCurrentSubscription =
    useCallback(async () => {
      const token =
        localStorage.getItem(
          "asp_access_token",
        );

      setIsLoggedIn(Boolean(token));

      if (!token) {
        setCurrentSubscription(null);
        setLoadingCurrent(false);
        return;
      }

      try {
        setLoadingCurrent(true);

        const response =
          await getCurrentSubscription();

        setCurrentSubscription(
          response.data ?? null,
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load current subscription.";

        if (
          message === "LOGIN_REQUIRED"
        ) {
          localStorage.removeItem(
            "asp_access_token",
          );

          localStorage.removeItem(
            "asp_refresh_token",
          );

          setIsLoggedIn(false);
          setCurrentSubscription(null);
          return;
        }

        setError(message);
      } finally {
        setLoadingCurrent(false);
      }
    }, []);

  useEffect(() => {
    void Promise.all([
      loadPlans(),
      loadCurrentSubscription(),
    ]);
  }, [
    loadCurrentSubscription,
    loadPlans,
  ]);

  const activeSubscription =
    useMemo(() => {
      if (!currentSubscription) {
        return null;
      }

      if (
        currentSubscription.subscriptionStatus ===
          "ACTIVE" ||
        currentSubscription.subscriptionStatus ===
          "TRIAL"
      ) {
        return currentSubscription;
      }

      return null;
    }, [currentSubscription]);

  function isCurrentPlan(
    plan: SubscriptionPlan,
  ): boolean {
    return (
      currentSubscription?.subscriptionPlanId ===
        plan.id ||
      currentSubscription
        ?.subscriptionPlan?.name ===
        plan.name
    );
  }

  function canRetryPendingPlan(
    plan: SubscriptionPlan,
  ): boolean {
    return (
      currentSubscription?.subscriptionStatus ===
        "PENDING" &&
      isCurrentPlan(plan)
    );
  }

  async function reconcileAndRefresh(
    order: RazorpayOrder,
  ) {
    setPaymentMessage(
      "Verifying payment and activating your subscription...",
    );

    const reconciliation =
      await reconcileSubscriptionPayment(
        order.id,
      );

    if (
      reconciliation.status === "FAILED"
    ) {
      throw new Error(
        "Payment could not be verified. No subscription access was activated.",
      );
    }

    await loadCurrentSubscription();

    setPaymentMessage("");

    setSuccessMessage(
      "Payment verified. Your subscription has been activated.",
    );
  }

  async function openRazorpayCheckout(
    plan: SubscriptionPlan,
    order: RazorpayOrder,
  ) {
    if (!razorpayKeyId) {
      throw new Error(
        "NEXT_PUBLIC_RAZORPAY_KEY_ID is not configured in the frontend environment.",
      );
    }

    const scriptLoaded =
      await loadRazorpayScript();

    if (
      !scriptLoaded ||
      !window.Razorpay
    ) {
      throw new Error(
        "Unable to load Razorpay Checkout. Check your internet connection and try again.",
      );
    }

    const storedUser =
      readStoredUser();

    const options: RazorpayOptions = {
      key: razorpayKeyId,
      amount: order.amount,
      currency: order.currency,
      name: "Astro Soul Path",
      description:
        plan.displayName,
      order_id: order.id,

      handler: async (
        response:
          RazorpaySuccessResponse,
      ) => {
        try {
          setPaymentMessage(
            "Payment received. Verifying with Razorpay...",
          );

          localStorage.setItem(
            "asp_last_subscription_payment",
            JSON.stringify({
              planName: plan.name,
              orderId:
                response.razorpay_order_id,
              paymentId:
                response.razorpay_payment_id,
              createdAt:
                new Date().toISOString(),
            }),
          );

          await reconcileAndRefresh(
            order,
          );
        } catch (err: unknown) {
          setPaymentMessage("");

          setError(
            err instanceof Error
              ? err.message
              : "Payment was received, but verification is still pending.",
          );

          await loadCurrentSubscription();
        } finally {
          setProcessingPlan(null);
        }
      },

      prefill: {
        name: storedUser.name,
        email: storedUser.email,
        contact: storedUser.phone,
      },

      notes: {
        planName: plan.name,
        planId: plan.id,
      },

      theme: {
        color: "#D4AF37",
      },

      modal: {
        confirm_close: true,
        escape: true,
        ondismiss: () => {
          setPaymentMessage("");
          setProcessingPlan(null);

          setError(
            "Payment window was closed. Your subscription was not activated. You can retry payment.",
          );

          void loadCurrentSubscription();
        },
      },
    };

    const checkout =
      new window.Razorpay(options);

    checkout.on(
      "payment.failed",
      (
        response:
          RazorpayFailureResponse,
      ) => {
        setPaymentMessage("");
        setProcessingPlan(null);

        const description =
          response.error?.description;

        setError(
          description ||
            "Subscription payment failed. Please try again.",
        );

        void loadCurrentSubscription();
      },
    );

    checkout.open();
  }

  async function handleSubscribe(
    plan: SubscriptionPlan,
  ) {
    setError("");
    setSuccessMessage("");
    setPaymentMessage("");

    const planName =
      plan.name as SubscriptionPlanName;

    const token =
      localStorage.getItem(
        "asp_access_token",
      );

    if (!token) {
      router.push(
        `/login?redirect=${encodeURIComponent(
          "/subscriptions",
        )}`,
      );

      return;
    }

    if (
      !REQUIRED_PLAN_NAMES.includes(
        planName,
      )
    ) {
      setError(
        "This subscription plan is not available for checkout.",
      );

      return;
    }

    if (
      activeSubscription &&
      !isCurrentPlan(plan)
    ) {
      setError(
        "You already have another active subscription.",
      );

      return;
    }

    if (
      activeSubscription &&
      isCurrentPlan(plan)
    ) {
      setError(
        "This subscription is already active.",
      );

      return;
    }

    try {
      setProcessingPlan(planName);

      setPaymentMessage(
        "Creating secure payment order...",
      );

      const order =
        await createSubscriptionPaymentOrder(
          planName,
        );

      if (
        !order?.id ||
        !order.amount ||
        !order.currency
      ) {
        throw new Error(
          "Backend returned an invalid Razorpay order.",
        );
      }

      setPaymentMessage(
        "Opening secure payment window...",
      );

      await openRazorpayCheckout(
        plan,
        order,
      );
    } catch (err: unknown) {
      setPaymentMessage("");
      setProcessingPlan(null);

      const message =
        err instanceof Error
          ? err.message
          : "Unable to start subscription payment.";

      if (
        message === "LOGIN_REQUIRED"
      ) {
        localStorage.removeItem(
          "asp_access_token",
        );

        router.push(
          `/login?redirect=${encodeURIComponent(
            "/subscriptions",
          )}`,
        );

        return;
      }

      setError(message);

      await loadCurrentSubscription();
    }
  }

  async function handleCancelSubscription() {
    if (
      !currentSubscription ||
      cancelling
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "Cancel this subscription? This action will record the cancellation in your account.",
      );

    if (!confirmed) {
      return;
    }

    try {
      setCancelling(true);
      setError("");
      setSuccessMessage("");

      const response =
        await cancelSubscription(
          true,
          "Cancelled by user",
        );

      setCurrentSubscription(
        response.data,
      );

      setSuccessMessage(
        response.message ||
          "Subscription cancellation recorded.",
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to cancel subscription.";

      if (
        message === "LOGIN_REQUIRED"
      ) {
        localStorage.removeItem(
          "asp_access_token",
        );

        router.push(
          `/login?redirect=${encodeURIComponent(
            "/subscriptions",
          )}`,
        );

        return;
      }

      setError(message);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <section className="text-center">
          <p className="font-semibold text-[#D4AF37]">
            Astro Soul Path Plans
          </p>

          <h1 className="mx-auto mt-3 max-w-4xl text-4xl font-bold text-[#0B1026] sm:text-5xl">
            Choose the subscription made for
            your astrology journey
          </h1>

          <p className="mx-auto mt-5 max-w-3xl leading-7 text-gray-600">
            Customers can receive personalized
            daily Vedic guidance, while
            professional astrologers can access
            unlimited Kundli generation and
            reports.
          </p>
        </section>

        {paymentMessage && (
          <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-700">
            <h2 className="font-bold">
              Processing payment
            </h2>

            <p className="mt-1 text-sm">
              {paymentMessage}
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mx-auto mt-8 max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700"
          >
            <h2 className="font-bold">
              Unable to complete request
            </h2>

            <p className="mt-1 text-sm">
              {error}
            </p>
          </div>
        )}

        {successMessage && (
          <div className="mx-auto mt-8 max-w-4xl rounded-2xl border border-green-200 bg-green-50 p-5 text-green-700">
            <h2 className="font-bold">
              Request completed
            </h2>

            <p className="mt-1 text-sm">
              {successMessage}
            </p>
          </div>
        )}

        {!loadingCurrent &&
          currentSubscription && (
            <section className="mx-auto mt-10 max-w-4xl rounded-3xl bg-[#0B1026] p-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold text-[#D4AF37]">
                      Current Subscription
                    </p>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClasses(
                        currentSubscription.subscriptionStatus,
                      )}`}
                    >
                      {
                        currentSubscription.subscriptionStatus
                      }
                    </span>
                  </div>

                  <h2 className="mt-3 text-2xl font-bold">
                    {currentSubscription
                      .subscriptionPlan
                      ?.displayName ||
                      "Subscription Plan"}
                  </h2>

                  <div className="mt-4 grid gap-3 text-sm text-gray-300 sm:grid-cols-3">
                    <p>
                      Amount:{" "}
                      <strong className="text-white">
                        {formatSubscriptionAmount(
                          currentSubscription,
                        )}
                      </strong>
                    </p>

                    <p>
                      Start:{" "}
                      <strong className="text-white">
                        {formatDate(
                          currentSubscription.startDate,
                        )}
                      </strong>
                    </p>

                    <p>
                      Ends:{" "}
                      <strong className="text-white">
                        {formatDate(
                          currentSubscription.endDate,
                        )}
                      </strong>
                    </p>
                  </div>

                  {currentSubscription.subscriptionStatus ===
                    "PENDING" && (
                    <p className="mt-4 rounded-xl bg-yellow-400/10 p-3 text-sm text-yellow-200">
                      Payment is pending. Use
                      the Retry Payment button
                      on the matching plan to
                      continue checkout.
                    </p>
                  )}
                </div>

                {currentSubscription.subscriptionStatus ===
                  "ACTIVE" && (
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() =>
                      void handleCancelSubscription()
                    }
                    className="shrink-0 rounded-xl border border-red-300 px-5 py-3 font-semibold text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {cancelling
                      ? "Cancelling..."
                      : "Cancel Subscription"}
                  </button>
                )}
              </div>
            </section>
          )}

        <section className="mt-12">
          {loadingPlans ? (
            <div className="grid gap-8 lg:grid-cols-2">
              {Array.from({
                length: 2,
              }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-3xl bg-white p-8 shadow-lg"
                >
                  <div className="h-5 w-32 rounded bg-gray-200" />
                  <div className="mt-5 h-10 w-3/4 rounded bg-gray-200" />
                  <div className="mt-5 h-6 w-40 rounded bg-gray-200" />

                  <div className="mt-8 space-y-4">
                    {Array.from({
                      length: 6,
                    }).map(
                      (
                        _,
                        featureIndex,
                      ) => (
                        <div
                          key={
                            featureIndex
                          }
                          className="h-4 rounded bg-gray-200"
                        />
                      ),
                    )}
                  </div>

                  <div className="mt-8 h-14 rounded-xl bg-gray-200" />
                </div>
              ))}
            </div>
          ) : plans.length === 0 ? (
            <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
              <h2 className="text-2xl font-bold text-[#0B1026]">
                Subscription plans are not
                available
              </h2>

              <button
                type="button"
                onClick={() =>
                  void loadPlans()
                }
                className="mt-6 rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026]"
              >
                Reload Plans
              </button>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              {plans.map((plan) => {
                const planName =
                  plan.name as SubscriptionPlanName;

                const customerPlan =
                  planName ===
                  "DAILY_HOROSCOPE_MONTHLY";

                const currentPlan =
                  isCurrentPlan(plan);

                const pendingRetry =
                  canRetryPendingPlan(
                    plan,
                  );

                const processing =
                  processingPlan ===
                  planName;

                const disabled =
                  processingPlan !==
                    null ||
                  Boolean(
                    activeSubscription,
                  );

                return (
                  <article
                    key={plan.id}
                    className={`relative overflow-hidden rounded-3xl border bg-white p-8 shadow-lg ${
                      plan.isFeatured
                        ? "border-[#D4AF37]"
                        : "border-gray-200"
                    }`}
                  >
                    {plan.isFeatured && (
                      <div className="absolute right-0 top-0 rounded-bl-2xl bg-[#D4AF37] px-5 py-2 text-sm font-bold text-[#0B1026]">
                        Recommended
                      </div>
                    )}

                    <p className="font-semibold text-[#D4AF37]">
                      {getAudienceLabel(
                        plan,
                      )}
                    </p>

                    <h2 className="mt-3 pr-24 text-3xl font-bold text-[#0B1026]">
                      {plan.displayName}
                    </h2>

                    <p className="mt-4 min-h-14 leading-7 text-gray-600">
                      {plan.description ||
                        "Astro Soul Path subscription plan."}
                    </p>

                    <div className="mt-7 flex items-end gap-2">
                      <p className="text-5xl font-bold text-[#0B1026]">
                        {formatPrice(plan)}
                      </p>

                      <p className="pb-1 text-gray-500">
                        {getBillingLabel(
                          plan,
                        )}
                      </p>
                    </div>

                    <div className="mt-8 border-t border-gray-200 pt-7">
                      <h3 className="font-bold text-[#0B1026]">
                        What is included
                      </h3>

                      <ul className="mt-5 space-y-4">
                        {getFeatureList(
                          plan,
                        ).map(
                          (feature) => (
                            <li
                              key={
                                feature
                              }
                              className="flex gap-3 text-gray-700"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                                ✓
                              </span>

                              <span>
                                {feature}
                              </span>
                            </li>
                          ),
                        )}
                      </ul>
                    </div>

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        void handleSubscribe(
                          plan,
                        )
                      }
                      className={`mt-8 w-full rounded-xl px-6 py-4 font-semibold transition disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 ${
                        customerPlan
                          ? "bg-[#D4AF37] text-[#0B1026] hover:bg-[#C9A52F]"
                          : "bg-[#0B1026] text-white hover:bg-[#171D3D]"
                      }`}
                    >
                      {processing
                        ? "Opening Payment..."
                        : activeSubscription &&
                            currentPlan
                          ? "Current Plan"
                          : activeSubscription
                            ? "Another Plan Is Active"
                            : pendingRetry
                              ? "Retry Payment"
                              : customerPlan
                                ? "Pay $1 and Subscribe"
                                : "Pay ₹3,000 and Subscribe"}
                    </button>

                    {!isLoggedIn && (
                      <p className="mt-3 text-center text-xs text-gray-500">
                        Login is required
                        before payment.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-12 rounded-3xl bg-white p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-[#0B1026]">
            Secure payment flow
          </h2>

          <p className="mt-3 leading-7 text-gray-600">
            Payment orders are created by the
            backend. Subscription access is
            activated only after Razorpay
            payment verification and backend
            reconciliation.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/horoscope"
              className="rounded-xl border border-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026]"
            >
              View Horoscope
            </Link>

            <Link
              href="/kundli"
              className="rounded-xl border border-[#0B1026] px-5 py-3 font-semibold text-[#0B1026]"
            >
              Open Kundli
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}