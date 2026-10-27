"use client";

import { refreshAdminSession } from "@/features/admin/auth/admin-session";

import { getAdminApiBase } from "@/features/admin/auth/admin-contract";

import { useCallback, useEffect, useMemo, useState } from "react";

type MarketplaceOrderItem = {
  id: string;
  productName?: string | null;
  productSku?: string | null;
  quantity?: number;
  unitPrice?: string | number;
  lineTotal?: string | number;
};

type MarketplaceSellerOrder = {
  id: string;
  status?: string;
  sellerDisplayName?: string | null;
  currency?: string;
  subtotal?: string | number;
  shippingTotal?: string | number;
  grandTotal?: string | number;
  trackingCarrier?: string | null;
  trackingNumber?: string | null;
  items?: MarketplaceOrderItem[];
};

type MarketplaceOrder = {
  id: string;
  orderNumber?: string;
  status?: string;
  currency?: string;
  subtotal?: string | number;
  shippingTotal?: string | number;
  grandTotal?: string | number;
  createdAt?: string;
  customerName?: string | null;
  deliveryFullName?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryCountry?: string | null;
  sellerOrders?: MarketplaceSellerOrder[];
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  message?: string | string[];
  error?: string;
};

const API_BASE_URL = getAdminApiBase();

async function getAccessToken() {
  return refreshAdminSession();
}

function errorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;

  const source = body as Record<string, unknown>;
  const message = source.message;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  if (Array.isArray(message) && message.length > 0) {
    return message.map(String).join(", ");
  }

  if (typeof source.error === "string" && source.error.trim()) {
    return source.error.trim();
  }

  return fallback;
}

function money(value: unknown, currency?: string) {
  if (value === null || value === undefined || value === "") {
    return `${currency || "INR"} 0`;
  }

  return `${currency || "INR"} ${String(value)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function statusClass(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "COMPLETED":
    case "DELIVERED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";

    case "CONFIRMED":
    case "PROCESSING":
    case "SHIPPED":
    case "ACCEPTED":
      return "border-blue-500/30 bg-blue-500/10 text-blue-300";

    case "CANCELLED":
      return "border-red-500/30 bg-red-500/10 text-red-300";

    default:
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  }
}

export function MarketplaceOrders() {
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const pendingPayment = useMemo(
    () =>
      orders.filter(
        (order) => order.status?.toUpperCase() === "PENDING_PAYMENT",
      ).length,
    [orders],
  );

  const load = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      setLoading(false);
      setError("Admin session missing. Please login again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/admin/marketplace/orders`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const body = (await response.json().catch(() => null)) as ApiEnvelope<
        MarketplaceOrder[]
      > | null;

      if (!response.ok) {
        throw new Error(
          errorMessage(body, "Unable to load marketplace orders."),
        );
      }

      setOrders(Array.isArray(body?.data) ? body.data : []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load marketplace orders.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="text-[#14243D]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8A6818]">
            Order Oversight
          </p>

          <h3 className="mt-2 text-2xl font-semibold">Marketplace Orders</h3>

          <p className="mt-2 text-sm text-[#52627A]">
            Read-only view of customer orders and seller fulfillment groups.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#E5EAF1] bg-white p-5">
          <p className="text-sm text-[#52627A]">Total Orders</p>
          <p className="mt-2 text-3xl font-semibold">{orders.length}</p>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-white p-5">
          <p className="text-sm text-[#52627A]">Pending Payment</p>
          <p className="mt-2 text-3xl font-semibold text-[#8A6818]">
            {pendingPayment}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-xl border border-red-500/30 p-4 text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="text-[#52627A]">Loading marketplace orders...</p>
      ) : null}

      {!loading && !error && orders.length === 0 ? (
        <div className="rounded-2xl border border-[#E5EAF1] bg-white p-8 text-center">
          <p className="font-semibold text-[#14243D]">No marketplace orders yet</p>
          <p className="mt-2 text-sm text-[#52627A]">
            Real customer orders will appear here.
          </p>
        </div>
      ) : null}

      <div className="space-y-4">
        {orders.map((order) => {
          const currency = order.currency || "INR";
          const groups = Array.isArray(order.sellerOrders)
            ? order.sellerOrders
            : [];

          return (
            <article
              key={order.id}
              className="rounded-2xl border border-[#E5EAF1] bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h4 className="text-lg font-semibold">
                    {order.orderNumber || order.id}
                  </h4>

                  <p className="mt-1 text-xs text-[#52627A]">
                    {formatDate(order.createdAt)}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                    order.status,
                  )}`}
                >
                  {(order.status || "UNKNOWN").replaceAll("_", " ")}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs uppercase text-[#52627A]">Subtotal</p>
                  <p className="font-bold">{money(order.subtotal, currency)}</p>
                </div>

                <div>
                  <p className="text-xs uppercase text-[#52627A]">Shipping</p>
                  <p className="font-bold">
                    {money(order.shippingTotal, currency)}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase text-[#52627A]">Total</p>
                  <p className="font-semibold text-[#8A6818]">
                    {money(order.grandTotal, currency)}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {groups.map((group) => {
                  const items = Array.isArray(group.items) ? group.items : [];

                  return (
                    <div
                      key={group.id}
                      className="rounded-xl border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex flex-wrap justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {group.sellerDisplayName || "Marketplace Seller"}
                          </p>
                          <p className="mt-1 text-xs text-[#52627A]">
                            {items.length} item{items.length === 1 ? "" : "s"}
                          </p>
                        </div>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(
                            group.status,
                          )}`}
                        >
                          {(group.status || "PENDING").replaceAll("_", " ")}
                        </span>
                      </div>

                      {items.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap justify-between gap-3 text-sm"
                            >
                              <span className="text-[#14243D]">
                                {item.productName || "Product"} x{" "}
                                {item.quantity ?? 0}
                              </span>

                              <span className="font-bold text-[#14243D]">
                                {money(item.lineTotal, currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {group.trackingNumber ? (
                        <p className="mt-3 text-xs text-[#52627A]">
                          Tracking: {group.trackingCarrier || "Carrier"} /{" "}
                          {group.trackingNumber}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
