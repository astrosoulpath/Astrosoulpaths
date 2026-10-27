"use client";

import { refreshAdminSession } from "@/features/admin/auth/admin-session";

import { getAdminApiBase } from "@/features/admin/auth/admin-contract";

import { useCallback, useEffect, useState, useRef } from "react";
import ArticleEditor from "./ArticleEditor";

type Translation = {
  locale: string;
  title: string;
};

type Article = {
  id: string;
  slug: string;
  category: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED";
  authorType: "ADMIN" | "ASTROLOGER";
  reviewNote?: string | null;
  submittedAt?: string | null;
  isPublished: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
  translations: Translation[];
};

const API_BASE_URL = getAdminApiBase();

async function getAdminToken() {
  return refreshAdminSession();
}

function statusStyle(status: Article["status"]) {
  if (status === "PUBLISHED")
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  if (status === "REJECTED") return "bg-rose-50 text-rose-800 border-rose-200";
  if (status === "PENDING_REVIEW")
    return "bg-amber-50 text-amber-900 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function AdminArticleManagement() {
  const [editor, setEditor] = useState<unknown | undefined>(undefined);
  const [observedAt, setObservedAt] = useState(0);
  const mutationLock = useRef(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");

  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const mutate = options.method && options.method !== "GET";
      if (mutate && mutationLock.current)
        throw new Error("An article change is already in progress.");
      if (mutate) mutationLock.current = true;
      try {
        const token = await getAdminToken();
        if (!token)
          throw new Error("Admin login token missing. Please log in again.");

        const response = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {}),
          },
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            "Article request was not confirmed. Refresh before retrying.",
          );
        }

        return result;
      } finally {
        if (mutate) mutationLock.current = false;
      }
    },
    [],
  );

  const loadArticles = useCallback(
    async (nextStatus = status) => {
      try {
        setLoading(true);
        const result = await request(`/admin/articles?status=${nextStatus}`);
        setArticles(Array.isArray(result) ? result : []);
        setObservedAt(Date.now());
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to load articles.",
        );
      } finally {
        setLoading(false);
      }
    },
    [status, request],
  );

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  async function approve(article: Article) {
    if (
      !window.confirm(
        "Approve and publish this reviewed article to website and Flutter?",
      )
    )
      return;
    try {
      setWorkingId(article.id);
      setMessage("");
      await request(`/admin/articles/${article.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ expectedUpdatedAt: article.updatedAt }),
      });
      setMessage("Article approved and published.");
      await loadArticles();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to approve article.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  async function reject(article: Article) {
    if (reviewNote.trim().length < 3) {
      setMessage("Write a helpful rejection note first.");
      return;
    }

    try {
      setWorkingId(article.id);
      setMessage("");
      await request(`/admin/articles/${article.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({
          reviewNote: reviewNote.trim(),
          expectedUpdatedAt: article.updatedAt,
        }),
      });
      setRejectingId(null);
      setReviewNote("");
      setMessage("Article returned to astrologer with feedback.");
      await loadArticles();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to reject article.",
      );
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="rounded-[28px] border border-amber-300/20 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-4 border-b border-[#E5EAF1] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8A6818]">
            Global Content Control
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#14243D]">
            Article Review
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52627A]">
            Review astrologer submissions before they appear in the customer app
            worldwide.
          </p>
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-[#E5EAF1] bg-white px-3 py-2.5 text-sm font-bold text-[#14243D] outline-none"
        >
          <option value="PENDING_REVIEW">Pending review</option>
          <option value="PUBLISHED">Published</option>
          <option value="REJECTED">Rejected</option>
          <option value="DRAFT">Admin drafts</option>
        </select>
      </div>

      <button
        type="button"
        onClick={() => setEditor(null)}
        className="asp-admin-gold-btn px-5 py-3 mt-5"
      >
        New article draft
      </button>
      {editor !== undefined && (
        <ArticleEditor
          key={
            editor && typeof editor === "object" && "id" in editor
              ? String(editor.id)
              : "new"
          }
          initial={editor}
          onSaved={() => void loadArticles()}
          onClose={() => setEditor(undefined)}
        />
      )}

      {message ? (
        <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-[#8A6818]">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-[#52627A]">Loading articles...</p>
      ) : null}

      <div className="mt-6 grid gap-4">
        {articles.map((article) => {
          const english = article.translations.find(
            (item) => item.locale === "en",
          );
          const title =
            english?.title || article.translations[0]?.title || article.slug;

          return (
            <article
              key={article.id}
              className="rounded-2xl border border-[#E5EAF1] bg-white p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[13px] font-semibold ${statusStyle(article.status)}`}
                    >
                      {article.isPublished &&
                      article.publishedAt &&
                      Date.parse(article.publishedAt) > observedAt
                        ? "SCHEDULED"
                        : article.status.replace("_", " ")}
                    </span>
                    <span className="text-xs font-bold text-[#52627A]">
                      {article.authorType === "ASTROLOGER"
                        ? "Astrologer submission"
                        : "Admin editorial"}
                    </span>
                  </div>

                  <h2 className="mt-3 text-xl font-semibold text-[#14243D]">
                    {title}
                  </h2>
                  <button
                    className="min-h-11 underline text-[#765623]"
                    onClick={() => setEditor(article)}
                  >
                    Edit / preview / publishing
                  </button>
                  <p className="mt-1 text-sm text-[#52627A]">
                    {article.category} · {article.translations.length}/20
                    translations · {article.slug}
                  </p>
                </div>

                {article.status === "PENDING_REVIEW" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={workingId === article.id}
                      onClick={() => void approve(article)}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
                    >
                      Approve & publish
                    </button>
                    <button
                      type="button"
                      disabled={workingId === article.id}
                      onClick={() => {
                        setRejectingId(article.id);
                        setReviewNote("");
                      }}
                      className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-semibold text-red-700"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>

              {article.reviewNote ? (
                <p className="mt-4 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-red-700">
                  Previous feedback: {article.reviewNote}
                </p>
              ) : null}

              {rejectingId === article.id ? (
                <div className="mt-4 rounded-xl border border-rose-400/25 bg-white p-3">
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    rows={3}
                    placeholder="Explain exactly what the astrologer should improve..."
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white px-3 py-2.5 text-sm text-[#14243D] outline-none focus:border-rose-300"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={workingId === article.id}
                      onClick={() => void reject(article)}
                      className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-semibold text-[#14243D]"
                    >
                      Send feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(null)}
                      className="px-3 py-2 text-xs font-bold text-[#52627A]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        {!loading && articles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#E5EAF1] p-6 text-center text-sm text-[#52627A]">
            No articles in this status.
          </p>
        ) : null}
      </div>
    </section>
  );
}
