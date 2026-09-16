"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type MarketplaceCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "http://localhost:4000";

function getStoredAdminToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem("asp_admin_access_token") ??
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

function getErrorMessage(body: unknown, fallback: string) {
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof (body as { message?: unknown }).message === "string"
  ) {
    return (body as { message: string }).message;
  }

  return fallback;
}

export function MarketplaceCategories() {
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getStoredAdminToken();

      if (!token) {
        throw new Error("Admin session token not found. Please login again.");
      }

      const response = await fetch(
        `${API_BASE_URL}/admin/marketplace/categories`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      const body = (await response.json().catch(() => null)) as
        ApiResponse<MarketplaceCategory[]> | MarketplaceCategory[] | null;

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            body,
            `Unable to load categories (${response.status}).`,
          ),
        );
      }

      const rows = Array.isArray(body)
        ? body
        : Array.isArray(body?.data)
          ? body.data
          : [];

      setCategories(rows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load marketplace categories.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setSaving(true);
      setError(null);
      setNotice(null);

      const trimmedName = name.trim();

      if (!trimmedName) {
        throw new Error("Category name is required.");
      }

      const numericSortOrder = Number(sortOrder);

      if (!Number.isInteger(numericSortOrder) || numericSortOrder < 0) {
        throw new Error("Sort order must be a whole number 0 or greater.");
      }

      const token = getStoredAdminToken();

      if (!token) {
        throw new Error("Admin session token not found. Please login again.");
      }

      const payload: {
        name: string;
        description?: string;
        imageUrl?: string;
        sortOrder: number;
      } = {
        name: trimmedName,
        sortOrder: numericSortOrder,
      };

      if (description.trim()) {
        payload.description = description.trim();
      }

      if (imageUrl.trim()) {
        payload.imageUrl = imageUrl.trim();
      }

      const response = await fetch(
        `${API_BASE_URL}/admin/marketplace/categories`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            body,
            `Category creation failed (${response.status}).`,
          ),
        );
      }

      setName("");
      setDescription("");
      setImageUrl("");
      setSortOrder("0");

      setNotice("Category created successfully.");
      await loadCategories();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Category creation failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(category: MarketplaceCategory) {
    try {
      setWorkingId(category.id);
      setError(null);
      setNotice(null);

      const token = getStoredAdminToken();

      if (!token) {
        throw new Error("Admin session token not found. Please login again.");
      }

      const nextState = !category.isActive;

      const response = await fetch(
        `${API_BASE_URL}/admin/marketplace/categories/${category.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            isActive: nextState,
          }),
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `Category update failed (${response.status}).`),
        );
      }

      setNotice(
        nextState
          ? "Category enabled successfully."
          : "Category disabled successfully.",
      );

      await loadCategories();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Category update failed.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function editCategory(category: MarketplaceCategory) {
    const nextName = window.prompt("Category name:", category.name);

    if (nextName === null) {
      return;
    }

    const normalizedName = nextName.trim();

    if (!normalizedName) {
      setError("Category name cannot be empty.");
      return;
    }

    const nextDescription = window.prompt(
      "Category description:",
      category.description ?? "",
    );

    if (nextDescription === null) {
      return;
    }

    const nextSortOrder = window.prompt(
      "Sort order:",
      String(category.sortOrder ?? 0),
    );

    if (nextSortOrder === null) {
      return;
    }

    const numericSortOrder = Number(nextSortOrder);

    if (!Number.isInteger(numericSortOrder) || numericSortOrder < 0) {
      setError("Sort order must be a whole number 0 or greater.");
      return;
    }

    try {
      setWorkingId(category.id);
      setError(null);
      setNotice(null);

      const token = getStoredAdminToken();

      if (!token) {
        throw new Error("Admin session token not found. Please login again.");
      }

      const response = await fetch(
        `${API_BASE_URL}/admin/marketplace/categories/${category.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: normalizedName,
            description: nextDescription.trim(),
            sortOrder: numericSortOrder,
          }),
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          getErrorMessage(body, `Category update failed (${response.status}).`),
        );
      }

      setNotice("Category updated successfully.");
      await loadCategories();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Category update failed.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-yellow-400">
              Admin Controlled
            </p>

            <h1 className="mt-2 text-3xl font-bold">Marketplace Categories</h1>

            <p className="mt-2 text-sm text-slate-400">
              Categories available to marketplace sellers and customers are
              controlled here.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void loadCategories()}
              className="rounded-lg border border-yellow-500 px-4 py-2 text-sm font-semibold text-yellow-400"
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-5 rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-300">
            {notice}
          </div>
        ) : null}

        <section className="mb-8 rounded-xl border border-slate-800 bg-slate-950/70 p-6">
          <h2 className="text-xl font-bold">Create Category</h2>

          <p className="mt-1 text-sm text-slate-400">
            Add only genuine categories intended for the live marketplace.
          </p>

          <form
            onSubmit={createCategory}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <label className="text-sm">
              <span className="mb-1 block text-slate-300">Category name *</span>

              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
                className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 outline-none focus:border-yellow-500"
                placeholder="Enter real category name"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-slate-300">Sort order</span>

              <input
                type="number"
                min="0"
                step="1"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 outline-none focus:border-yellow-500"
              />
            </label>

            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-slate-300">Description</span>

              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 outline-none focus:border-yellow-500"
                placeholder="Optional category description"
              />
            </label>

            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-slate-300">Image URL</span>

              <input
                type="url"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-black px-3 py-2 outline-none focus:border-yellow-500"
                placeholder="Optional HTTPS image URL"
              />
            </label>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-yellow-400 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Category"}
              </button>
            </div>
          </form>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Existing Categories</h2>
              <p className="text-sm text-slate-400">
                Total: {categories.length}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-slate-800 p-6 text-slate-400">
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-slate-400">
              No marketplace categories exist yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {categories.map((category) => {
                const working = workingId === category.id;

                return (
                  <article
                    key={category.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold">{category.name}</h3>

                          <span
                            className={
                              category.isActive
                                ? "rounded-full border border-emerald-700 px-2 py-0.5 text-xs text-emerald-400"
                                : "rounded-full border border-red-800 px-2 py-0.5 text-xs text-red-400"
                            }
                          >
                            {category.isActive ? "ACTIVE" : "DISABLED"}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          Slug: {category.slug}
                        </p>

                        {category.description ? (
                          <p className="mt-3 max-w-3xl text-sm text-slate-300">
                            {category.description}
                          </p>
                        ) : null}

                        <p className="mt-2 text-xs text-slate-500">
                          Sort order: {category.sortOrder ?? 0}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={working}
                          onClick={() => void editCategory(category)}
                          className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={working}
                          onClick={() => void toggleCategory(category)}
                          className={
                            category.isActive
                              ? "rounded-lg border border-red-800 px-4 py-2 text-sm font-semibold text-red-400 disabled:opacity-50"
                              : "rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-400 disabled:opacity-50"
                          }
                        >
                          {working
                            ? "Working..."
                            : category.isActive
                              ? "Disable"
                              : "Enable"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
