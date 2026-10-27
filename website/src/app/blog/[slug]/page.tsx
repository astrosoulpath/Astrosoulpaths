import type { Metadata } from "next";
import Link from "next/link";
import Image from "@/features/articles/ArticleCover";
import { notFound } from "next/navigation";
import {
  articleDetail,
  articleFeed,
  articleDate,
  articleJsonLd,
  readingEstimate,
  type ArticleQuery,
} from "@/features/articles/article-api";
import ArticleMarkdown, {
  articleHeadings,
} from "@/features/articles/ArticleMarkdown";
import ArticleCard from "@/features/articles/ArticleCard";
import {
  ArticleFreshness,
  ArticleShare,
  ArticleRetry,
} from "@/features/articles/ArticleControls";
import s from "@/features/articles/articles.module.css";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};
async function resolveArticle(props: Props) {
  const { slug } = await props.params,
    params = await props.searchParams;
  const query: ArticleQuery = {
    locale: typeof params.locale === "string" ? params.locale : undefined,
    country: typeof params.country === "string" ? params.country : undefined,
  };
  return { article: await articleDetail(slug, query), query };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  try {
    const { article } = await resolveArticle(props);
    if (!article)
      return {
        title: "Article not found",
        robots: { index: false, follow: false },
      };
    return {
      title: article.seoTitle || article.title,
      description: article.seoDescription || article.excerpt || undefined,
      alternates: { canonical: "/blog/" + article.slug },
      authors: article.authorName ? [{ name: article.authorName }] : [],
      openGraph: {
        type: "article",
        title: article.title,
        description: article.excerpt || undefined,
        url: "/blog/" + article.slug,
        images: article.coverImageUrl ? [article.coverImageUrl] : [],
        publishedTime: article.publishedAt || undefined,
      },
      twitter: {
        card: article.coverImageUrl ? "summary_large_image" : "summary",
        title: article.title,
      },
    };
  } catch {
    return {
      title: "Article unavailable",
      robots: { index: false, follow: false },
    };
  }
}
export default async function ArticlePage(props: Props) {
  let resolved;
  try {
    resolved = await resolveArticle(props);
  } catch {
    return (
      <main className={s.page}>
        <section className={s.empty}>
          <h1>Article unavailable</h1>
          <p>Please retry when the connection is restored.</p>
          <ArticleRetry />
          <Link href="/blog">Back to Articles</Link>
        </section>
      </main>
    );
  }
  const { article, query } = resolved;
  if (!article) notFound();
  let related: Awaited<ReturnType<typeof articleFeed>> = [];
  try {
    related = (
      await articleFeed({ ...query, category: article.category, limit: "4" })
    )
      .filter((a) => a.id !== article.id)
      .slice(0, 3);
  } catch {
    /* Reading remains available if related content cannot load. */
  }
  const headings = articleHeadings(article.contentMarkdown),
    date = articleDate(article.publishedAt),
    minutes = readingEstimate(article);
  return (
    <main
      className={s.page}
      lang={article.locale}
      dir={
        ["ar", "ur"].includes(article.locale.split("-")[0]) ? "rtl" : undefined
      }
    >
      <ArticleFreshness />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: articleJsonLd(article) }}
      />
      <header className={s.hero}>
        <div className={s.detailHead}>
          <Link
            href={
              "/blog" +
              (query.country
                ? "?country=" + encodeURIComponent(query.country)
                : "")
            }
          >
            ← Back to Articles
          </Link>
          <p className={s.eyebrow}>{article.category.replaceAll("_", " ")}</p>
          <h1>{article.title}</h1>
          <div className={s.meta}>
            {article.authorName && <span>{article.authorName}</span>}
            {date && <time dateTime={article.publishedAt!}>{date}</time>}
            {minutes && <span>{minutes} min read · estimate</span>}
            <span>{article.locale.toUpperCase()}</span>
          </div>
        </div>
      </header>
      <article className={s.reading}>
        {article.coverImageUrl && (
          <Image
            src={article.coverImageUrl}
            alt={article.title}
            width={1100}
            height={690}
            sizes="(max-width:900px) 95vw, 830px"
            className={s.cover}
          />
        )}
        {article.excerpt && <p className={s.excerpt}>{article.excerpt}</p>}
        {headings.length >= 4 && (
          <nav className={s.toc} aria-label="In this article">
            <strong>In this article</strong>
            {headings.map((h) => (
              <a href={"#" + h.id} key={h.id}>
                {h.title}
              </a>
            ))}
          </nav>
        )}
        <ArticleMarkdown source={article.contentMarkdown} />
        <ArticleShare title={article.title} />
        {related.length > 0 && (
          <section className={s.related}>
            <h2>Related articles</h2>
            <div className={s.grid}>
              {related.map((a) => (
                <ArticleCard article={a} query={query} key={a.id} />
              ))}
            </div>
          </section>
        )}
      </article>
    </main>
  );
}
