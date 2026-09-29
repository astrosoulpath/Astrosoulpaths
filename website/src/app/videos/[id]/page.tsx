"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type VideoDetail = {
  id: string;
  youtubeVideoId: string;
  category: string;
  locale: string;
  title: string;
  shortDescription?: string | null;
  description?: string | null;
  captionUrl?: string | null;
  audioLocale?: string | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

function getViewerPreference() {
  const locale = navigator.language || "en";
  const country = locale
    .split("-")
    .find((item) => /^[A-Z]{2}$/.test(item));

  return { locale, country };
}

export default function AstrologyVideoDetailPage() {
  const params = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadVideo() {
      try {
        const { locale, country } = getViewerPreference();
        const search = new URLSearchParams({ locale });

        if (country) {
          search.set("country", country);
        }

        const response = await fetch(
          `${API_BASE_URL}/videos/${params.id}?${search}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("This video is unavailable in your region.");
        }

        setVideo((await response.json()) as VideoDetail);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load video.",
        );
      }
    }

    if (params.id) {
      void loadVideo();
    }
  }, [params.id]);

  return (
    <main className="min-h-screen bg-[linear-gradient(145deg,#07101f,#0b1426_48%,#050914)] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/videos"
          className="inline-flex rounded-full border border-amber-300/30 bg-slate-950/60 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-400/10"
        >
          ← All Video Lessons
        </Link>

        {error ? (
          <div className="mt-8 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-5 text-rose-100">
            {error}
          </div>
        ) : !video ? (
          <p className="py-20 text-center text-slate-400">Loading video lesson...</p>
        ) : (
          <article className="mt-6 overflow-hidden rounded-[30px] border border-slate-800 bg-slate-950/75 shadow-2xl">
            <div className="aspect-video bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.youtubeVideoId}?rel=0`}
                title={video.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="p-6 sm:p-9">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                {video.category.replaceAll("_", " ")} · {video.locale.toUpperCase()}
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
                {video.title}
              </h1>

              {video.shortDescription ? (
                <p className="mt-5 text-lg leading-8 text-slate-300">
                  {video.shortDescription}
                </p>
              ) : null}

              {video.description ? (
                <div className="mt-7 whitespace-pre-line border-t border-slate-800 pt-7 text-base leading-8 text-slate-300">
                  {video.description}
                </div>
              ) : null}

              {video.captionUrl ? (
                <a
                  href={video.captionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-7 inline-flex rounded-xl border border-amber-300/40 px-4 py-3 text-sm font-black text-amber-200 hover:bg-amber-400/10"
                >
                  Open subtitles / transcript
                </a>
              ) : null}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}