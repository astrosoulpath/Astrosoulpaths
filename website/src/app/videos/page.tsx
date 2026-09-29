"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Video = {
  id: string;
  youtubeVideoId: string;
  thumbnailUrl?: string | null;
  category: string;
  isFeatured: boolean;
  locale: string;
  title: string;
  shortDescription?: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function getViewerPreference() {
  const locale = navigator.language || "en";
  const country = locale.split("-").find((item) => /^[A-Z]{2}$/.test(item));

  return { locale, country };
}

function categoryLabel(category: string) {
  return category
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AstrologyVideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadVideos() {
      try {
        setLoading(true);
        const { locale, country } = getViewerPreference();
        const search = new URLSearchParams({ locale });

        if (country) {
          search.set("country", country);
        }

        const response = await fetch(`${API_BASE_URL}/videos?${search}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Video lessons are unavailable right now.");
        }

        const result = await response.json();
        setVideos(Array.isArray(result) ? result : []);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load video lessons.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadVideos();
  }, []);

  const groupedVideos = useMemo(() => {
    return videos.reduce<Record<string, Video[]>>((groups, video) => {
      const category = video.category || "ASTROLOGY_LESSONS";
      groups[category] = [...(groups[category] || []), video];
      return groups;
    }, {});
  }, [videos]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.12),_transparent_30%),linear-gradient(145deg,#07101f,#0b1426_45%,#050914)] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/dashboard"
          className="inline-flex rounded-full border border-amber-300/30 bg-slate-950/60 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-400/10"
        >
          ? Back to Dashboard
        </Link>

        <section className="mt-6 rounded-[30px] border border-amber-300/20 bg-slate-950/50 p-6 shadow-2xl sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-400">
            Astro Soul Path Learning
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Astrology Video Lessons
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
            Explore trusted astrology lessons in your preferred language. When a
            local translation is unavailable, English is shown automatically.
          </p>
        </section>

        {loading ? (
          <p className="py-16 text-center text-slate-400">
            Loading astrology videos...
          </p>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5 text-rose-100">
            {error}
          </div>
        ) : videos.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 p-10 text-center text-slate-400">
            New astrology lessons will appear here after the admin publishes
            them.
          </div>
        ) : (
          <div className="mt-10 space-y-12">
            {Object.entries(groupedVideos).map(([category, items]) => (
              <section key={category}>
                <div className="mb-5 flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-black">
                    {categoryLabel(category)}
                  </h2>
                  <span className="rounded-full border border-amber-300/25 px-3 py-1 text-xs font-bold text-amber-200">
                    {items.length} lessons
                  </span>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((video) => (
                    <Link
                      key={video.id}
                      href={`/videos/${video.id}`}
                      className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/75 shadow-xl transition hover:-translate-y-1 hover:border-amber-300/50"
                    >
                      <div className="relative aspect-video overflow-hidden bg-slate-900">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : null}
                        <div className="absolute inset-0 grid place-items-center bg-slate-950/20">
                          <span className="grid h-14 w-14 place-items-center rounded-full bg-red-600 text-xl shadow-xl">
                            ?
                          </span>
                        </div>
                        {video.isFeatured ? (
                          <span className="absolute left-3 top-3 rounded-full bg-amber-300 px-2.5 py-1 text-[10px] font-black text-slate-950">
                            FEATURED
                          </span>
                        ) : null}
                      </div>

                      <div className="p-4">
                        <p className="line-clamp-2 text-base font-black text-white">
                          {video.title}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                          {video.shortDescription ||
                            "Tap to watch this astrology lesson."}
                        </p>
                        <p className="mt-3 text-xs font-bold text-amber-300">
                          {video.locale.toUpperCase()} � Watch lesson ?
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
