"use client";

import { useEffect, useState } from "react";

type Translation = {
  locale: string;
  title: string;
  shortDescription?: string;
  description?: string;
};

type Video = {
  id: string;
  youtubeUrl: string;
  youtubeVideoId: string;
  thumbnailUrl?: string | null;
  category: string;
  defaultLocale: string;
  visibilityCountries: string[];
  isFeatured: boolean;
  isPublished: boolean;
  sortOrder: number;
  translations: Translation[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const emptyTranslation = (): Translation => ({
  locale: "en",
  title: "",
  shortDescription: "",
  description: "",
});

const emptyForm = () => ({
  youtubeUrl: "",
  category: "ASTROLOGY_LESSONS",
  defaultLocale: "en",
  countries: "",
  isFeatured: false,
  sortOrder: 0,
  translations: [emptyTranslation()],
});

function getAdminToken() {
  return (
    window.localStorage.getItem("asp_admin_access_token") ??
    window.localStorage.getItem("asp_access_token") ??
    window.localStorage.getItem("access_token")
  );
}

export function AdminVideoManagement() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function request(path: string, options: RequestInit = {}) {
    const token = getAdminToken();

    if (!token) {
      throw new Error("Admin login token missing. Please log in again.");
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers ?? {}),
      },
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.error ||
          `Request failed (${response.status}).`,
      );
    }

    return result;
  }

  async function loadVideos() {
    try {
      setLoading(true);
      const result = await request("/admin/videos");
      setVideos(Array.isArray(result) ? result : []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to load videos.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVideos();
  }, []);

  function updateTranslation(
    index: number,
    key: keyof Translation,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      translations: current.translations.map((translation, itemIndex) =>
        itemIndex === index ? { ...translation, [key]: value } : translation,
      ),
    }));
  }

  function addLanguage() {
    setForm((current) => ({
      ...current,
      translations: [
        ...current.translations,
        { locale: "", title: "", shortDescription: "", description: "" },
      ],
    }));
  }

  function removeLanguage(index: number) {
    setForm((current) => ({
      ...current,
      translations: current.translations.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }

  async function saveVideo() {
    try {
      setSaving(true);
      setMessage(null);

      const body = {
        youtubeUrl: form.youtubeUrl,
        category: form.category,
        defaultLocale: form.defaultLocale,
        visibilityCountries: form.countries
          .split(",")
          .map((country) => country.trim().toUpperCase())
          .filter(Boolean),
        isFeatured: form.isFeatured,
        sortOrder: Number(form.sortOrder) || 0,
        translations: form.translations,
      };

      await request(
        editingId ? `/admin/videos/${editingId}` : "/admin/videos",
        {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify(body),
        },
      );

      setMessage(
        editingId ? "Video updated successfully." : "Video saved as draft.",
      );
      setEditingId(null);
      setForm(emptyForm());
      await loadVideos();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save video.",
      );
    } finally {
      setSaving(false);
    }
  }

  function editVideo(video: Video) {
    setEditingId(video.id);
    setForm({
      youtubeUrl: video.youtubeUrl,
      category: video.category,
      defaultLocale: video.defaultLocale,
      countries: video.visibilityCountries.join(", "),
      isFeatured: video.isFeatured,
      sortOrder: video.sortOrder,
      translations: video.translations.map((translation) => ({
        locale: translation.locale,
        title: translation.title,
        shortDescription: translation.shortDescription ?? "",
        description: translation.description ?? "",
      })),
    });

    document.getElementById("video-management")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function changePublish(video: Video, publish: boolean) {
    try {
      setMessage(null);
      await request(
        `/admin/videos/${video.id}/${publish ? "publish" : "unpublish"}`,
        {
          method: "PATCH",
        },
      );
      setMessage(publish ? "Video published globally." : "Video unpublished.");
      await loadVideos();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update video.",
      );
    }
  }

  async function deleteVideo(video: Video) {
    if (
      !window.confirm(
        `Delete "${video.translations[0]?.title || "this video"}"?`,
      )
    ) {
      return;
    }

    try {
      await request(`/admin/videos/${video.id}`, { method: "DELETE" });
      setMessage("Video deleted.");
      await loadVideos();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete video.",
      );
    }
  }

  return (
    <section
      id="video-management"
      className="mt-8 scroll-mt-8 rounded-[28px] border border-amber-300/20 bg-slate-950/55 p-5 shadow-2xl sm:p-7"
    >
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">
            Global Content Control
          </p>
          <h2 className="mt-2 text-3xl font-black text-white">
            Video Management
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Add YouTube lessons once. Show localized titles and descriptions
            worldwide, with automatic English fallback where a language is
            unavailable.
          </p>
        </div>

        <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
          {videos.filter((video) => video.isPublished).length} published
        </span>
      </div>

      {message ? (
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-100">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-black text-white">
              {editingId ? "Edit Video" : "Add YouTube Video"}
            </h3>

            {editingId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm());
                }}
                className="text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
                YouTube URL
              </span>
              <input
                value={form.youtubeUrl}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    youtubeUrl: event.target.value,
                  }))
                }
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Category
              </span>
              <input
                value={form.category}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                placeholder="PLANETS / KUNDLI / REMEDIES"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Default Locale
              </span>
              <input
                value={form.defaultLocale}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    defaultLocale: event.target.value,
                  }))
                }
                placeholder="en"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400"
              />
            </label>

            <label className="sm:col-span-2">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Countries (optional)
              </span>
              <input
                value={form.countries}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    countries: event.target.value,
                  }))
                }
                placeholder="Leave empty for all countries. Example: IN, FR, BR"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
                Display order
              </span>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    sortOrder: Number(event.target.value),
                  }))
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400"
              />
            </label>

            <label className="flex items-end gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm font-bold text-slate-200">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isFeatured: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-amber-400"
              />
              Feature this video first
            </label>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-white">Language content</h4>
              <button
                type="button"
                onClick={addLanguage}
                className="rounded-lg border border-amber-400/50 px-3 py-1.5 text-xs font-black text-amber-300 hover:bg-amber-400/10"
              >
                + Add language
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {form.translations.map((translation, index) => (
                <div
                  key={`${translation.locale}-${index}`}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-[120px_1fr_auto]">
                    <input
                      value={translation.locale}
                      onChange={(event) =>
                        updateTranslation(index, "locale", event.target.value)
                      }
                      placeholder="en / fr / ar"
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    />
                    <input
                      value={translation.title}
                      onChange={(event) =>
                        updateTranslation(index, "title", event.target.value)
                      }
                      placeholder="Localized video title"
                      className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeLanguage(index)}
                      disabled={form.translations.length === 1}
                      className="rounded-xl px-3 py-2 text-xs font-bold text-rose-300 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Remove
                    </button>
                  </div>

                  <input
                    value={translation.shortDescription ?? ""}
                    onChange={(event) =>
                      updateTranslation(
                        index,
                        "shortDescription",
                        event.target.value,
                      )
                    }
                    placeholder="Short card description"
                    className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                  />

                  <textarea
                    value={translation.description ?? ""}
                    onChange={(event) =>
                      updateTranslation(
                        index,
                        "description",
                        event.target.value,
                      )
                    }
                    placeholder="Full lesson description shown below the video"
                    rows={3}
                    className="mt-3 w-full resize-y rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveVideo()}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : editingId
                ? "Save changes"
                : "Save as draft"}
          </button>
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/55 p-4 sm:p-5">
          <h3 className="text-lg font-black text-white">
            Published & draft videos
          </h3>

          <div className="mt-4 max-h-[800px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <p className="py-10 text-center text-sm text-slate-400">
                Loading videos...
              </p>
            ) : videos.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                No videos yet. Add your first YouTube astrology lesson.
              </p>
            ) : (
              videos.map((video) => {
                const title =
                  video.translations.find(
                    (translation) => translation.locale === video.defaultLocale,
                  )?.title ||
                  video.translations[0]?.title ||
                  "Untitled video";

                return (
                  <article
                    key={video.id}
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/75"
                  >
                    <div className="flex gap-3 p-3">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt=""
                          className="h-20 w-32 rounded-xl object-cover"
                        />
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 font-black text-white">
                            {title}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                              video.isPublished
                                ? "bg-emerald-400/15 text-emerald-300"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
                            {video.isPublished ? "LIVE" : "DRAFT"}
                          </span>
                        </div>

                        <p className="mt-1 text-xs font-bold text-amber-300">
                          {video.category.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {video.translations
                            .map((item) => item.locale)
                            .join(", ")}{" "}
                          �{" "}
                          {video.visibilityCountries.length
                            ? video.visibilityCountries.join(", ")
                            : "All countries"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 border-t border-slate-800 text-xs font-black">
                      <button
                        type="button"
                        onClick={() => editVideo(video)}
                        className="border-r border-slate-800 px-2 py-3 text-sky-300 hover:bg-sky-400/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void changePublish(video, !video.isPublished)
                        }
                        className="border-r border-slate-800 px-2 py-3 text-amber-300 hover:bg-amber-400/10"
                      >
                        {video.isPublished ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteVideo(video)}
                        className="px-2 py-3 text-rose-300 hover:bg-rose-400/10"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
