"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import s from "./articles.module.css";
export function ArticleSearch({ query }: { query: string }) {
  const router = useRouter(),
    [value, setValue] = useState(query);
  useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => {
      const url = new URL(location.href);
      if (value.trim()) url.searchParams.set("q", value.trim());
      else url.searchParams.delete("q");
      url.searchParams.delete("offset");
      router.replace(url.pathname + url.search, { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [value, query, router]);
  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const url = new URL(location.href);
        if (value.trim()) url.searchParams.set("q", value.trim());
        else url.searchParams.delete("q");
        url.searchParams.delete("offset");
        router.push(url.pathname + url.search, { scroll: false });
      }}
    >
      <label htmlFor="article-search">Find an article</label>
      <div className={s.search}>
        <input
          id="article-search"
          name="q"
          value={value}
          maxLength={120}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search titles and descriptions"
          type="search"
        />
        <button type="submit">Search</button>
      </div>
    </form>
  );
}
export function ArticleFreshness() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) router.refresh();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);
  return null;
}
export function ArticleShare({ title }: { title: string }) {
  const [status, setStatus] = useState("");
  return (
    <div className={s.share}>
      <button
        onClick={async () => {
          try {
            const url = location.href;
            if (navigator.share) await navigator.share({ title, url });
            else {
              await navigator.clipboard.writeText(url);
              setStatus("Link copied.");
            }
          } catch {
            setStatus(
              "Sharing was not completed. Copy the page address from your browser.",
            );
          }
        }}
      >
        Share / copy link
      </button>
      <span role="status">{status}</span>
    </div>
  );
}
export function ArticleRetry() {
  const router = useRouter();
  return (
    <button className={s.read} onClick={() => router.refresh()}>
      Retry articles
    </button>
  );
}
