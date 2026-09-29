"use client";

import { useEffect, useState } from "react";

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
  translations: Translation[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function getAdminToken() {
  return (
    window.localStorage.getItem("asp_admin_access_token") ??
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

function statusStyle(status: Article["status"]) {
  if (status === "PUBLISHED") return "bg-emerald-400/10 text-emerald-300 border-emerald-400/30";
  if (status === "REJECTED") return "bg-rose-400/10 text-rose-300 border-rose-400/30";
  if (status === "PENDING_REVIEW") return "bg-amber-400/10 text-amber-200 border-amber-400/30";
  return "bg-slate-400/10 text-slate-300 border-slate-400/30";
}

export function AdminArticleManagement() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [message, setMessage] = useState("");

  async function request(path: string, options: RequestInit = {}) {
    const token = getAdminToken();
    if (!token) throw new Error("Admin login token missing. Please log in again.");

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.message || `Request failed (${response.status}).`);
    }

    return result;
  }

  async function loadArticles(nextStatus = status) {
    try {
      setLoading(true);
      const result = await request(`/admin/articles?status=${nextStatus}`);
      setArticles(Array.isArray(result) ? result : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load articles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles();
  }, [status]);

  async function approve(article: Article) {
    try {
      setWorkingId(article.id);
      setMessage("");
      await request(`/admin/articles/${article.id}/approve`, { method: "PATCH" });
      setMessage("Article approved and published.");
      await loadArticles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to approve article.");
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
        body: JSON.stringify({ reviewNote: reviewNote.trim() }),
      });
      setRejectingId(null);
      setReviewNote("");
      setMessage("Article returned to astrologer with feedback.");
      await loadArticles();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reject article.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="rounded-[28px] border border-amber-300/20 bg-slate-950/90 p-5 shadow-2xl sm:p-7">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">
            Global Content Control
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Article Review</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Review astrologer submissions before they appear in the customer app worldwide.
          </p>
        </div>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm font-bold text-white outline-none"
        >
          <option value="PENDING_REVIEW">Pending review</option>
          <option value="PUBLISHED">Published</option>
          <option value="REJECTED">Rejected</option>
          <option value="DRAFT">Admin drafts</option>
        </select>
      </div>

      {message ? (
        <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
          {message}
        </p>
      ) : null}

      {loading ? <p className="mt-6 text-sm text-slate-400">Loading articles...</p> : null}

      <div className="mt-6 grid gap-4">
        {articles.map((article) => {
          const english = article.translations.find((item) => item.locale === "en");
          const title = english?.title || article.translations[0]?.title || article.slug;

          return (
            <article key={article.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${statusStyle(article.status)}`}>
                      {article.status.replace("_", " ")}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {article.authorType === "ASTROLOGER" ? "Astrologer submission" : "Admin editorial"}
                    </span>
                  </div>

                  <h2 className="mt-3 text-xl font-black text-white">{title}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {article.category} · {article.translations.length}/20 translations · {article.slug}
                  </p>
                </div>

                {article.status === "PENDING_REVIEW" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={workingId === article.id}
                      onClick={() => void approve(article)}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60"
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
                      className="rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-black text-rose-200"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>

              {article.reviewNote ? (
                <p className="mt-4 rounded-xl bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
                  Previous feedback: {article.reviewNote}
                </p>
              ) : null}

              {rejectingId === article.id ? (
                <div className="mt-4 rounded-xl border border-rose-400/25 bg-slate-950 p-3">
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    rows={3}
                    placeholder="Explain exactly what the astrologer should improve..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-300"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={workingId === article.id}
                      onClick={() => void reject(article)}
                      className="rounded-lg bg-rose-500 px-3 py-2 text-xs font-black text-white"
                    >
                      Send feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(null)}
                      className="px-3 py-2 text-xs font-bold text-slate-400"
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
          <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
            No articles in this status.
          </p>
        ) : null}
      </div>
    </section>
  );
}