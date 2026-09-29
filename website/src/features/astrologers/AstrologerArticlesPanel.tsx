"use client";

import { useEffect, useState } from "react";
import {
  AstrologerArticle,
  ArticleTranslationPayload,
  getMyArticles,
  submitAstrologerArticle,
} from "@/services/astrologerDashboardService";

const supportedLocales = [
  "ar", "bn", "de", "en", "es", "fr", "gu", "hi", "it", "ja",
  "kn", "ko", "ml", "mr", "pa", "pt", "ru", "ta", "te", "zh",
];

function emptyTranslations(): ArticleTranslationPayload[] {
  return supportedLocales.map((locale) => ({
    locale,
    title: "",
    excerpt: "",
    contentMarkdown: "",
    readingMinutes: 3,
  }));
}

function emptyForm() {
  return {
    slug: "",
    category: "ASTROLOGY",
    festivalTags: "",
    countries: "",
    translations: emptyTranslations(),
  };
}

function statusClass(status: AstrologerArticle["status"]) {
  if (status === "PUBLISHED") return "bg-emerald-100 text-emerald-700";
  if (status === "REJECTED") return "bg-rose-100 text-rose-700";
  if (status === "PENDING_REVIEW") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export function AstrologerArticlesPanel() {
  const [articles, setArticles] = useState<AstrologerArticle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadArticles() {
    try {
      setLoading(true);
      setArticles(await getMyArticles());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load articles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadArticles();
  }, []);

  function updateTranslation(
    locale: string,
    field: keyof ArticleTranslationPayload,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.locale === locale
          ? { ...translation, [field]: value }
          : translation,
      ),
    }));
  }

  async function submit() {
    const incomplete = form.translations.find(
      (item) => item.title.trim().length < 4 || item.contentMarkdown.trim().length < 40,
    );

    if (!form.slug.trim()) {
      setMessage("Please add an article slug.");
      return;
    }

    if (incomplete) {
      setMessage(
        `Complete title and article content for ${incomplete.locale}. All 20 supported languages are required.`,
      );
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      await submitAstrologerArticle({
        slug: form.slug.trim().toLowerCase(),
        category: form.category.trim().toUpperCase() || "ASTROLOGY",
        festivalTags: form.festivalTags
          .split(",")
          .map((tag) => tag.trim().toUpperCase())
          .filter(Boolean),
        visibilityCountries: form.countries
          .split(",")
          .map((country) => country.trim().toUpperCase())
          .filter(Boolean),
        defaultLocale: "en",
        translations: form.translations,
      });

      setForm(emptyForm());
      setMessage("Article submitted to Admin for review.");
      await loadArticles();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to submit article.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl bg-white p-6 shadow sm:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#B58A16]">
            Global Editorial Program
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[#0B1026]">
            Articles & Insights
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Submit your original insight. Admin review ke baad hi worldwide publish hoga.
          </p>
        </div>
        <span className="rounded-full bg-[#FFF6D8] px-3 py-1.5 text-xs font-bold text-[#7B5C15]">
          {articles.length} submissions
        </span>
      </div>

      {message ? (
        <p className="mt-5 rounded-xl bg-[#FFF8E5] px-4 py-3 text-sm font-semibold text-[#745617]">
          {message}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-[#E9DFCB] bg-[#FFFCF7] p-4 sm:p-5">
          <h3 className="text-lg font-bold text-[#0B1026]">Write a global article</h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              placeholder="article-slug-in-lowercase"
              className="rounded-xl border border-[#DED4C1] bg-white px-3 py-3 text-sm outline-none focus:border-[#D4AF37]"
            />
            <input
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="ASTROLOGY / TAROT / NUMEROLOGY"
              className="rounded-xl border border-[#DED4C1] bg-white px-3 py-3 text-sm outline-none focus:border-[#D4AF37]"
            />
            <input
              value={form.festivalTags}
              onChange={(event) => setForm((current) => ({ ...current, festivalTags: event.target.value }))}
              placeholder="Festival tags: DIWALI, ECLIPSE"
              className="rounded-xl border border-[#DED4C1] bg-white px-3 py-3 text-sm outline-none focus:border-[#D4AF37]"
            />
            <input
              value={form.countries}
              onChange={(event) => setForm((current) => ({ ...current, countries: event.target.value }))}
              placeholder="Countries: leave empty for global"
              className="rounded-xl border border-[#DED4C1] bg-white px-3 py-3 text-sm outline-none focus:border-[#D4AF37]"
            />
          </div>

          <div className="mt-5 max-h-[620px] space-y-4 overflow-y-auto pr-1">
            {form.translations.map((translation) => (
              <div key={translation.locale} className="rounded-xl border border-[#E9DFCB] bg-white p-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-[#7B5C15]">
                  {translation.locale}
                </p>
                <input
                  value={translation.title}
                  onChange={(event) => updateTranslation(translation.locale, "title", event.target.value)}
                  placeholder={`Professional title in ${translation.locale}`}
                  className="w-full rounded-lg border border-[#DED4C1] px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                />
                <input
                  value={translation.excerpt ?? ""}
                  onChange={(event) => updateTranslation(translation.locale, "excerpt", event.target.value)}
                  placeholder="Short card summary"
                  className="mt-2 w-full rounded-lg border border-[#DED4C1] px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                />
                <textarea
                  value={translation.contentMarkdown}
                  onChange={(event) => updateTranslation(translation.locale, "contentMarkdown", event.target.value)}
                  placeholder="Full localized article content"
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-[#DED4C1] px-3 py-2.5 text-sm outline-none focus:border-[#D4AF37]"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-5 rounded-xl bg-[#0B1026] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit all 20 translations for review"}
          </button>
        </div>

        <div>
          <h3 className="text-lg font-bold text-[#0B1026]">My article status</h3>
          {loading ? <p className="mt-4 text-sm text-gray-500">Loading submissions...</p> : null}

          <div className="mt-4 space-y-3">
            {articles.map((article) => (
              <article key={article.id} className="rounded-2xl border border-[#E9DFCB] bg-[#FFFCF7] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-[#0B1026]">
                      {article.translations.find((item) => item.locale === "en")?.title ||
                        article.translations[0]?.title ||
                        article.slug}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">{article.category} · {article.translations.length}/20 languages</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${statusClass(article.status)}`}>
                    {article.status.replace("_", " ")}
                  </span>
                </div>

                {article.reviewNote ? (
                  <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    Admin feedback: {article.reviewNote}
                  </p>
                ) : null}
              </article>
            ))}

            {!loading && articles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#D9CBAE] p-4 text-sm text-gray-500">
                No article submitted yet.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}