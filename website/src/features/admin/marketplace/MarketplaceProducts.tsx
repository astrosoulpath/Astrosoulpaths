"use client";

import { refreshAdminSession } from "@/features/admin/auth/admin-session";

import { getAdminApiBase } from "@/features/admin/auth/admin-contract";

import { useCallback, useEffect, useState } from "react";

type Product = {
  id: string;
  name?: string;
  status: string;
  sellingPrice?: string | number;
  stock?: number;
  rejectionReason?: string;
  isFeatured?: boolean;
  category?: { name?: string };
};

const API = getAdminApiBase();

async function getToken() {
  return refreshAdminSession();
}

export function MarketplaceProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const accessToken = await getToken();
      if (!accessToken)
        throw new Error("Admin session not found. Please login again.");
      const response = await fetch(`${API}/admin/marketplace/products`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.message || "Unable to load products.");
      setProducts(
        Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function controlProduct(
    id: string,
    action: "archive" | "feature" | "unfeature",
  ) {
    const accessToken = await getToken();

    if (!accessToken) {
      setError("Admin session not found.");
      return;
    }

    if (
      action === "archive" &&
      !window.confirm(
        "Archive this product? It will no longer be available to customers.",
      )
    ) {
      return;
    }

    setWorking(id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API}/admin/marketplace/products/${id}/${action}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message || `Product ${action} failed.`);
      }

      setMessage(
        action === "archive"
          ? "Product archived successfully."
          : action === "feature"
            ? "Product featured successfully."
            : "Product unfeatured successfully.",
      );

      await load();
    } catch (controlError) {
      setError(
        controlError instanceof Error
          ? controlError.message
          : "Product control failed.",
      );
    } finally {
      setWorking("");
    }
  }
  async function moderate(id: string, action: "approve" | "reject") {
    let reason = "";
    if (action === "reject") {
      reason = window.prompt("Enter rejection reason:")?.trim() || "";
      if (!reason) return;
    }

    setWorking(id);
    setMessage("");
    setError("");
    try {
      const accessToken = await getToken();
      if (!accessToken) throw new Error("Admin session not found.");
      const response = await fetch(
        `${API}/admin/marketplace/products/${id}/${action}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(action === "reject"
              ? { "Content-Type": "application/json" }
              : {}),
          },
          ...(action === "reject" ? { body: JSON.stringify({ reason }) } : {}),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(body?.message || `Product ${action} failed.`);
      setMessage(
        action === "approve"
          ? "Product approved successfully."
          : "Product rejected successfully.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Moderation failed.");
    } finally {
      setWorking("");
    }
  }

  const pending = products.filter((p) => p.status === "PENDING_REVIEW").length;
  const active = products.filter((p) => p.status === "ACTIVE").length;

  return (
    <div className="text-[#14243D]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#8A6818]">
              Astro Soul Path
            </p>
            <h1 className="mt-2 text-3xl font-bold">Marketplace Products</h1>
            <p className="mt-2 text-[#52627A]">
              Admin approval for seller-submitted products.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => void load()}
              className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-black"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white p-5">
            <p className="text-[#52627A]">Total</p>
            <p className="mt-2 text-3xl font-bold">{products.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-400/20 bg-white p-5">
            <p className="text-[#52627A]">Pending Review</p>
            <p className="mt-2 text-3xl font-bold text-[#8A6818]">{pending}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-white p-5">
            <p className="text-[#52627A]">Active</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">{active}</p>
          </div>
        </div>

        {message ? (
          <div className="mb-5 rounded-xl border border-emerald-500/30 p-4 text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/30 p-4 text-red-700">
            {error}
          </div>
        ) : null}
        {loading ? <p className="text-[#52627A]">Loading products...</p> : null}

        <div className="space-y-4">
          {products.map((product) => (
            <article
              key={product.id}
              className="rounded-2xl border border-white/10 bg-white p-6"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">
                    {product.name || "Unnamed product"}
                  </h2>
                  <p className="mt-2 text-sm text-[#8A6818]">
                    {product.status.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-sm text-[#52627A]">
                    Category: {product.category?.name || "—"}
                  </p>
                </div>
                <div>
                  <p className="font-bold text-[#8A6818]">
                    {product.sellingPrice != null
                      ? `INR ${product.sellingPrice}`
                      : "—"}
                  </p>
                  <p className="text-sm text-[#52627A]">
                    Stock: {product.stock ?? "—"}
                  </p>
                </div>
              </div>

              {product.rejectionReason ? (
                <p className="mt-4 text-red-700">
                  Rejection: {product.rejectionReason}
                </p>
              ) : null}

              {product.status === "PENDING_REVIEW" ? (
                <div className="mt-5 flex gap-3">
                  <button
                    disabled={working === product.id}
                    onClick={() => void moderate(product.id, "approve")}
                    className="rounded-xl bg-emerald-500 px-5 py-2 font-bold text-black disabled:opacity-50"
                  >
                    {working === product.id ? "Working..." : "Approve"}
                  </button>
                  <button
                    disabled={working === product.id}
                    onClick={() => void moderate(product.id, "reject")}
                    className="rounded-xl border border-red-500/40 px-5 py-2 text-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              ) : null}

              {product.status === "ACTIVE" ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={working === product.id}
                    onClick={() =>
                      void controlProduct(
                        product.id,
                        product.isFeatured ? "unfeature" : "feature",
                      )
                    }
                    className="rounded-xl border border-yellow-500/40 px-5 py-2 font-semibold text-[#8A6818] disabled:opacity-50"
                  >
                    {working === product.id
                      ? "Working..."
                      : product.isFeatured
                        ? "Unfeature"
                        : "Feature"}
                  </button>

                  <button
                    type="button"
                    disabled={working === product.id}
                    onClick={() => void controlProduct(product.id, "archive")}
                    className="rounded-xl border border-orange-500/40 px-5 py-2 font-semibold text-orange-300 disabled:opacity-50"
                  >
                    Archive
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
