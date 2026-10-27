import type { Metadata } from "next";
import Link from "next/link";
import { articleFeed, articleRequest, type ArticleQuery } from "./article-api";
import ArticleCard from "./ArticleCard";
import {
  ArticleFreshness,
  ArticleSearch,
  ArticleRetry,
} from "./ArticleControls";
import s from "./articles.module.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Articles & Knowledge Center",
  description:
    "Explore published astrology articles from the Astro Soul Path editorial community.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Astro Soul Path Articles",
    type: "website",
    url: "/blog",
  },
};
export function listingLink(
  query: ArticleQuery,
  changes: Partial<ArticleQuery> = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...query, ...changes }))
    if (v && k !== "limit") params.set(k, v);
  return "/blog" + (params.size ? "?" + params : "");
}
export default async function ArticlesIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    query: ArticleQuery = {};
  for (const k of ["locale", "country", "category", "q", "offset"] as const)
    if (typeof params[k] === "string") query[k] = params[k];
  let articles,
    categories: string[] = [];
  try {
    const [feed, values] = await Promise.all([
      articleFeed({ ...query, limit: "13" }),
      articleRequest("/articles/catalogue/categories", { country: query.country }),
    ]);
    articles = feed;
    categories = Array.isArray(values)
      ? values.filter((v) => typeof v === "string")
      : [];
  } catch {
    return (
      <main className={s.page}>
        <header className={s.hero}>
          <div>
            <p className={s.eyebrow}>Knowledge Center</p>
            <h1>Astro Soul Path Articles</h1>
            <p>
              Articles could not be loaded. Please check your connection and
              retry.
            </p>
            <ArticleRetry />
          </div>
        </header>
      </main>
    );
  }
  const offset = Number(query.offset) || 0,
    visible = articles.slice(0, 12),
    featured =
      offset === 0 && !query.q && !query.category
        ? visible.find((a) => a.isFeatured)
        : undefined;
  return (
    <main className={s.page}>
      <ArticleFreshness />
      <header className={s.hero}>
        <div>
          <p className={s.eyebrow}>Knowledge Center</p>
          <h1>Astro Soul Path Articles</h1>
          <p>
            Explore astrology, reflect on new perspectives, and read at your own
            pace.
          </p>
          <ArticleSearch key={query.q || ""} query={query.q || ""} />
        </div>
      </header>
      <div className={s.body}>
        <nav className={s.categories} aria-label="Article categories">
          <Link
            prefetch={false}
            href={listingLink(query, {
              category: undefined,
              offset: undefined,
            })}
            aria-current={!query.category ? "page" : undefined}
          >
            All articles
          </Link>
          {categories.map((category) => (
            <Link
              prefetch={false}
              key={category}
              href={listingLink(query, { category, offset: undefined })}
              aria-current={query.category === category ? "page" : undefined}
            >
              {category.replaceAll("_", " ")}
            </Link>
          ))}
        </nav>
        {featured && <ArticleCard article={featured} query={query} featured />}
        {visible.length ? (
          <div className={s.grid}>
            {visible
              .filter((a) => a.id !== featured?.id)
              .map((article) => (
                <ArticleCard key={article.id} article={article} query={query} />
              ))}
          </div>
        ) : (
          <section className={s.empty}>
            <h2>
              {query.q || query.category
                ? "No matching articles"
                : "No published articles yet"}
            </h2>
            <p>
              {query.q || query.category
                ? "Try another search or category."
                : "This space will display approved articles when they are available."}
            </p>
            {(query.q || query.category) && (
              <Link
                href={listingLink(query, {
                  q: undefined,
                  category: undefined,
                  offset: undefined,
                })}
              >
                Clear filters
              </Link>
            )}
          </section>
        )}
        <nav className={s.pagination} aria-label="Article pages">
          <span>
            {offset > 0 && (
              <Link
                prefetch={false}
                href={listingLink(query, {
                  offset: String(Math.max(0, offset - 12)),
                })}
              >
                Previous page
              </Link>
            )}
          </span>
          <span>Page {Math.floor(offset / 12) + 1}</span>
          <span>
            {articles.length > 12 && (
              <Link
                prefetch={false}
                href={listingLink(query, { offset: String(offset + 12) })}
              >
                Next page
              </Link>
            )}
          </span>
        </nav>
        <aside className={s.cta}>
          <div>
            <h2>Bring your questions into conversation</h2>
            <p>Explore the existing astrologer profiles when you are ready.</p>
          </div>
          <Link href="/astrologers">Meet astrologers ↗</Link>
        </aside>
      </div>
    </main>
  );
}
