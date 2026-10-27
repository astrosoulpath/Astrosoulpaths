"use client";
import { useEffect, useState } from "react";
import { getAdminApiBase } from "@/features/admin/auth/admin-contract";
import AboutView from "./AboutView";
import { readAbout, type AboutContent } from "./about-contract";
import s from "./about.module.css";
export default function AboutPage() {
  const [content, setContent] = useState<AboutContent | null>(null),
    [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true,
      sequence = 0;
    async function load() {
      const request = ++sequence;
      setError(false);
      try {
        const response = await fetch(getAdminApiBase() + "/app-config/about", {
          cache: "no-store",
          credentials: "omit",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(12000),
          ]),
        });
        if (!response.ok) throw Error();
        const result = await response.json(),
          next = readAbout(result.data?.content);
        if (active && request === sequence) setContent(next);
      } catch {
        if (active && request === sequence) setError(true);
      }
    }
    void load();
    const refresh = () => {
      if (!document.hidden) void load();
    };
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [attempt]);
  return (
    <main>
      {error && (
        <div role="alert" className={s.state}>
          About Us could not be refreshed.{" "}
          <button onClick={() => setAttempt((v) => v + 1)}>Try again</button>
        </div>
      )}
      {content ? (
        <AboutView content={content} />
      ) : (
        <section className={s.state} aria-busy={!error}>
          <h1>About Astro Soul Path</h1>
          <p>
            {error
              ? "Please retry to view our approved company introduction."
              : "Loading our story..."}
          </p>
        </section>
      )}
    </main>
  );
}
