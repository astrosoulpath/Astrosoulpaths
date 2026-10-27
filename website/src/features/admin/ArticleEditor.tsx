"use client";
import { useEffect, useRef, useState } from "react";
import { adminFetch } from "./auth/admin-session";
import ArticleMarkdown from "@/features/articles/ArticleMarkdown";
type Translation = {
  locale: string;
  title: string;
  excerpt: string;
  contentMarkdown: string;
  authorName: string;
  seoTitle: string;
  seoDescription: string;
  readingMinutes?: number;
};
type Form = {
  id?: string;
  slug: string;
  category: string;
  coverImageUrl: string;
  defaultLocale: string;
  visibilityCountries: string[];
  festivalTags: string[];
  isFeatured: boolean;
  publishedAt: string;
  isPublished: boolean;
  updatedAt?: string;
  translations: Translation[];
};
const emptyTranslation = (locale = "en"): Translation => ({
  locale,
  title: "",
  excerpt: "",
  contentMarkdown: "",
  authorName: "",
  seoTitle: "",
  seoDescription: "",
});
function initialForm(value: unknown): Form {
  const a = (value || {}) as Partial<Form>;
  return {
    id: a.id,
    slug: a.slug || "",
    category: a.category || "",
    coverImageUrl: a.coverImageUrl || "",
    defaultLocale: a.defaultLocale || "en",
    visibilityCountries: a.visibilityCountries || [],
    festivalTags: a.festivalTags || [],
    isFeatured: a.isFeatured === true,
    publishedAt: a.publishedAt || "",
    isPublished: a.isPublished === true,
    updatedAt: a.updatedAt,
    translations: a.translations?.map((t) => ({
      ...emptyTranslation(t.locale),
      ...t,
      excerpt: t.excerpt || "",
      authorName: t.authorName || "",
      seoTitle: t.seoTitle || "",
      seoDescription: t.seoDescription || "",
    })) || [emptyTranslation()],
  };
}
export default function ArticleEditor({
  initial,
  onSaved,
  onClose,
}: {
  initial: unknown;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => initialForm(initial)),
    [locale, setLocale] = useState(form.defaultLocale),
    [newLocale, setNewLocale] = useState(""),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [audit, setAudit] = useState<{ action: string; at: string }[]>([]);
  const lock = useRef(false),
    mounted = useRef(true);
  const [savedForm, setSavedForm] = useState(() => JSON.stringify(form));
  const dirty = JSON.stringify(form) !== savedForm;
  const t =
    form.translations.find((t) => t.locale === locale) || form.translations[0];
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function field(key: keyof Translation, value: string) {
    setForm({
      ...form,
      translations: form.translations.map((item) =>
        item.locale === t.locale ? { ...item, [key]: value } : item,
      ),
    });
  }
  async function request(action: "save" | "publish" | "unpublish" | "audit") {
    if (lock.current) return;
    if (action === "save" && form.isPublished) {
      setMessage("Unpublish before editing.");
      return;
    }
    if (action === "publish" && dirty) {
      setMessage("Save draft changes before publishing.");
      return;
    }
    if (
      (action === "publish" || action === "unpublish") &&
      !window.confirm(
        action === "publish"
          ? "Publish this reviewed article, or schedule it for the specified publication date?"
          : "Unpublish this article from website and Flutter?",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (
        action === "save" &&
        (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) ||
          !form.category.trim() ||
          form.translations.some(
            (t) =>
              t.title.trim().length < 4 || t.contentMarkdown.trim().length < 40,
          ))
      )
        throw Error(
          "Add a valid slug, category, a title of at least 4 characters and at least 40 characters of body text for each translation.",
        );
      if (action !== "save" && !form.id) throw Error("Save the draft first.");
      const path =
        "/admin/articles" +
        (form.id ? "/" + encodeURIComponent(form.id) : "") +
        (action === "save" ? "" : action === "audit" ? "/audit" : "/" + action);
      const payload =
        action === "save"
          ? {
              slug: form.slug,
              category: form.category,
              coverImageUrl: form.coverImageUrl,
              defaultLocale: form.defaultLocale,
              visibilityCountries: form.visibilityCountries
                .map((v) => v.trim().toUpperCase())
                .filter(Boolean),
              festivalTags: form.festivalTags
                .map((v) => v.trim())
                .filter(Boolean),
              isFeatured: form.isFeatured,
              publishedAt: form.publishedAt,
              translations: form.translations,
              expectedUpdatedAt: form.updatedAt,
            }
          : {
              expectedUpdatedAt: form.updatedAt,
              publishedAt: form.publishedAt || undefined,
            };
      const r = await adminFetch(path, {
        method: action === "audit" ? "GET" : form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(action === "audit" ? {} : { body: JSON.stringify(payload) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok)
        throw Error(
          r.status === 409
            ? "Article changed or is published. Reload before saving."
            : "Change not confirmed. Reload the saved record before retrying.",
        );
      const result = await r.json();
      if (!mounted.current) return;
      if (action === "audit") {
        setAudit(Array.isArray(result) ? result : []);
        return;
      }
      const next = initialForm({
        ...form,
        ...result,
        translations: result.translations || form.translations,
      });
      setSavedForm(JSON.stringify(next));
      setForm(next);
      setMessage(
        action === "save"
          ? "Draft saved. No publication requested."
          : action === "publish"
            ? "Publication state saved; future dates stay hidden until due."
            : "Article unpublished.",
      );
      onSaved();
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error ? error.message : "Article operation failed.",
        );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const input =
    "w-full rounded-xl border border-[#d7dce6] bg-white p-3 text-[#17213a]";
  return (
    <section
      aria-label="Article editor"
      className="my-6 rounded-2xl border border-[#e4d8bd] bg-[#fcf9f1] p-5"
    >
      <div className="flex flex-wrap justify-between gap-3">
        <h2 className="text-2xl font-serif">
          {form.id ? "Edit article" : "New article draft"}
        </h2>
        <button
          disabled={busy}
          onClick={onClose}
          className="min-h-11 underline"
        >
          Close editor
        </button>
      </div>
      <p className="my-3">
        {form.isPublished
          ? "Published: unpublish before changing the content."
          : "Draft edits are private until explicitly published."}
      </p>
      <p role="status" className="my-3">
        {message}
      </p>
      <fieldset
        disabled={busy || form.isPublished}
        className="grid gap-4 sm:grid-cols-2"
      >
        {(["slug", "category", "coverImageUrl"] as const).map((key) => (
          <label key={key} className="grid gap-2">
            {key === "coverImageUrl"
              ? "Cover image · verified public HTTPS URL"
              : key}
            <input
              className={input}
              value={form[key]}
              maxLength={key === "coverImageUrl" ? 2000 : 180}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="grid gap-2">
          Default locale
          <select
            className={input}
            value={form.defaultLocale}
            onChange={(e) =>
              setForm({ ...form, defaultLocale: e.target.value })
            }
          >
            {form.translations.map((t) => (
              <option key={t.locale}>{t.locale}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          Country visibility · ISO codes, blank means global
          <input
            className={input}
            value={form.visibilityCountries.join(",")}
            onChange={(e) =>
              setForm({
                ...form,
                visibilityCountries: e.target.value.split(","),
              })
            }
          />
        </label>
        <label className="grid gap-2">
          Festival tags · comma separated
          <input
            className={input}
            value={form.festivalTags.join(",")}
            onChange={(e) =>
              setForm({ ...form, festivalTags: e.target.value.split(",") })
            }
          />
        </label>
        <label className="grid gap-2">
          Publication time · your browser timezone
          <input
            className={input}
            type="datetime-local"
            value={
              form.publishedAt
                ? new Date(
                    new Date(form.publishedAt).getTime() -
                      new Date(form.publishedAt).getTimezoneOffset() * 60000,
                  )
                    .toISOString()
                    .slice(0, 16)
                : ""
            }
            onChange={(e) =>
              setForm({
                ...form,
                publishedAt: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : "",
              })
            }
          />
        </label>
        <label className="flex gap-3 items-center">
          <input
            type="checkbox"
            checked={form.isFeatured}
            onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
          />
          Feature this article
        </label>
      </fieldset>
      <div className="my-5 flex flex-wrap items-center gap-3">
        <label>
          Translation{" "}
          <select
            value={t.locale}
            onChange={(e) => setLocale(e.target.value)}
            className="border rounded-lg p-3"
          >
            {form.translations.map((t) => (
              <option key={t.locale}>{t.locale}</option>
            ))}
          </select>
        </label>
        {!form.isPublished && (
          <>
            <input
              aria-label="New translation locale"
              value={newLocale}
              placeholder="e.g. hi"
              maxLength={12}
              onChange={(e) => setNewLocale(e.target.value)}
              className="w-32 border rounded-lg p-3"
            />
            <button
              disabled={busy}
              className="min-h-11 underline"
              onClick={() => {
                if (
                  !/^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(newLocale) ||
                  form.translations.some((t) => t.locale === newLocale)
                ) {
                  setMessage("Use a unique supported locale code.");
                  return;
                }
                setForm({
                  ...form,
                  translations: [
                    ...form.translations,
                    emptyTranslation(newLocale),
                  ],
                });
                setLocale(newLocale);
                setNewLocale("");
              }}
            >
              Add translation
            </button>
          </>
        )}
      </div>
      <fieldset disabled={busy || form.isPublished} className="grid gap-4">
        {(
          [
            "title",
            "excerpt",
            "contentMarkdown",
            "authorName",
            "seoTitle",
            "seoDescription",
          ] as const
        ).map((key) => (
          <label key={key} className="grid gap-2">
            {
              {
                title: "Title",
                excerpt: "Description / excerpt",
                contentMarkdown:
                  "Article body · Markdown, raw HTML is not executed",
                authorName: "Verified author attribution",
                seoTitle: "SEO title",
                seoDescription: "SEO description",
              }[key]
            }
            <textarea
              className={input}
              rows={key === "contentMarkdown" ? 12 : 2}
              value={t[key]}
              maxLength={
                key === "contentMarkdown"
                  ? 100000
                  : key === "title"
                    ? 180
                    : key === "excerpt"
                      ? 2000
                      : 500
              }
              onChange={(e) => field(key, e.target.value)}
            />
          </label>
        ))}
      </fieldset>
      {dirty && (
        <p className="mt-4">
          Unsaved changes. Save the draft before publication.
        </p>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          disabled={busy || form.isPublished}
          onClick={() => void request("save")}
          className="asp-admin-gold-btn px-5 py-3"
        >
          Save draft
        </button>
        <button
          disabled={busy}
          onClick={() => setPreview(!preview)}
          className="border rounded-xl px-5 py-3"
        >
          {preview ? "Hide" : "Preview"} draft
        </button>
        {form.id && (
          <>
            <button
              disabled={busy || (!form.isPublished && dirty)}
              onClick={() =>
                void request(form.isPublished ? "unpublish" : "publish")
              }
              className="border rounded-xl px-5 py-3"
            >
              {form.isPublished ? "Unpublish" : "Publish / schedule"}
            </button>
            <button
              disabled={busy}
              onClick={() => void request("audit")}
              className="border rounded-xl px-5 py-3"
            >
              Load audit history
            </button>
          </>
        )}
      </div>
      {preview && (
        <article
          aria-label="Private article preview"
          className="mt-6 bg-white rounded-xl p-5"
        >
          <p>Private preview · not a public link</p>
          <h2 className="text-3xl font-serif mt-4">{t.title}</h2>
          {t.excerpt && <p className="my-4">{t.excerpt}</p>}
          <ArticleMarkdown source={t.contentMarkdown} />
        </article>
      )}
      {audit.length > 0 && (
        <ul className="mt-5">
          {audit.map((entry, i) => (
            <li key={i}>
              {entry.action} · {new Date(entry.at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
