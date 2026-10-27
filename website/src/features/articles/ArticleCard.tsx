import Link from "next/link";
import Image from "@/features/articles/ArticleCover";
import {
  articleDate,
  articleLink,
  readingEstimate,
  type Article,
  type ArticleQuery,
} from "./article-api";
import s from "./articles.module.css";
export default function ArticleCard({
  article,
  query = {},
  featured = false,
}: {
  article: Article;
  query?: ArticleQuery;
  featured?: boolean;
}) {
  const date = articleDate(article.publishedAt),
    minutes = readingEstimate(article);
  return (
    <article className={featured ? s.featured : s.card}>
      {article.coverImageUrl && (
        <Link
          href={articleLink(article, query)}
          prefetch={false}
          tabIndex={-1}
          aria-hidden="true"
        >
          <Image
            src={article.coverImageUrl}
            alt=""
            width={900}
            height={560}
            className={s.cover}
            sizes={
              featured
                ? "(max-width:700px) 90vw, 50vw"
                : "(max-width:700px) 90vw, 33vw"
            }
          />
        </Link>
      )}
      <div className={s.cardBody}>
        <p className={s.eyebrow}>
          {featured ? "FEATURED · " : ""}
          {article.category.replaceAll("_", " ")}
        </p>
        <h2>
          <Link href={articleLink(article, query)} prefetch={false}>
            {article.title}
          </Link>
        </h2>
        {article.excerpt && <p>{article.excerpt}</p>}
        <div className={s.meta}>
          {article.authorName && <span>{article.authorName}</span>}
          {date && <time dateTime={article.publishedAt!}>{date}</time>}
          {minutes && <span>{minutes} min read · estimate</span>}
          <span lang={article.locale}>{article.locale.toUpperCase()}</span>
        </div>
        <Link
          href={articleLink(article, query)}
          prefetch={false}
          className={s.read}
        >
          Read article <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
