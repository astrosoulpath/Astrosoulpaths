export type Article = {
  id: string;
  slug: string;
  title: string;
  category: string;
  locale: string;
  contentMarkdown: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  authorName?: string | null;
  isFeatured?: boolean;
  publishedAt?: string | null;
  updatedAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  readingMinutes?: number;
};
export type ArticleQuery = {
  locale?: string;
  country?: string;
  category?: string;
  q?: string;
  offset?: string;
  limit?: string;
};
export function articleBase(value = process.env.NEXT_PUBLIC_API_BASE_URL) {
  if (!value) throw Error("Articles are unavailable.");
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    )
  )
    throw Error("Articles are unavailable.");
  return value.replace(/\/+$/, "");
}
export function safeArticleUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[|0\.)/i.test(
        u.hostname,
      ) ||
      /\.svg$/i.test(u.pathname)
    )
      return null;
    return u.toString();
  } catch {
    return null;
  }
}
export function readArticle(value: unknown): Article {
  if (!value || typeof value !== "object")
    throw Error("Invalid article response.");
  const a = value as Article;
  if (
    typeof a.id !== "string" ||
    !a.id ||
    typeof a.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug) ||
    typeof a.title !== "string" ||
    typeof a.contentMarkdown !== "string" ||
    typeof a.category !== "string" ||
    typeof a.locale !== "string"
  )
    throw Error("Invalid article response.");
  // Explicit public projection; never pass unknown API fields into the editor/DOM.
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    category: a.category,
    locale: a.locale,
    contentMarkdown: a.contentMarkdown,
    excerpt: typeof a.excerpt === "string" ? a.excerpt : null,
    authorName: typeof a.authorName === "string" ? a.authorName : null,
    coverImageUrl: safeArticleUrl(a.coverImageUrl),
    isFeatured: a.isFeatured === true,
    publishedAt: typeof a.publishedAt === "string" ? a.publishedAt : null,
    updatedAt: typeof a.updatedAt === "string" ? a.updatedAt : null,
    seoTitle: typeof a.seoTitle === "string" ? a.seoTitle : null,
    seoDescription:
      typeof a.seoDescription === "string" ? a.seoDescription : null,
    readingMinutes:
      typeof a.readingMinutes === "number" && a.readingMinutes > 0
        ? a.readingMinutes
        : undefined,
  };
}
export async function articleRequest(path: string, query: ArticleQuery = {}) {
  if (!/^\/articles(?:\/catalogue\/categories|\/[a-z0-9-]+)?$/.test(path))
    throw Error("Invalid article route.");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value) params.set(key, value);
  const response = await fetch(articleBase() + path + "?" + params.toString(), {
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(12000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw Error("Articles could not be loaded. Please retry.");
  return response.json() as Promise<unknown>;
}
export async function articleFeed(query: ArticleQuery = {}) {
  const value = await articleRequest("/articles", query);
  if (!Array.isArray(value)) throw Error("Articles could not be loaded.");
  return value.map(readArticle);
}
export async function articleDetail(slug: string, query: ArticleQuery = {}) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  const value = await articleRequest("/articles/" + slug, query);
  return value ? readArticle(value) : null;
}
export function articleLink(
  a: Pick<Article, "slug">,
  query: ArticleQuery = {},
) {
  const params = new URLSearchParams();
  if (query.locale) params.set("locale", query.locale);
  if (query.country) params.set("country", query.country);
  return "/blog/" + a.slug + (params.size ? "?" + params : "");
}
export function articleDate(value?: string | null) {
  return value && !Number.isNaN(Date.parse(value))
    ? new Intl.DateTimeFormat("en", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(value))
    : null;
}
export function readingEstimate(
  article: Pick<Article, "contentMarkdown" | "locale">,
) {
  const text = article.contentMarkdown.replace(/[#*`>\[\]()]/g, " ").trim();
  if (!text) return null;
  try {
    return Math.max(
      1,
      Math.ceil(
        [
          ...new Intl.Segmenter(article.locale, {
            granularity: "word",
          }).segment(text),
        ].filter((s) => s.isWordLike).length / 200,
      ),
    );
  } catch {
    return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
  }
}
export function articleJsonLd(article: Article) {
  const value = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.seoDescription || article.excerpt || undefined,
    url: "https://astrosoulpath.com/blog/" + article.slug,
    image: article.coverImageUrl || undefined,
    ...(article.authorName
      ? { author: { "@type": "Person", name: article.authorName } }
      : {}),
    ...(articleDate(article.publishedAt)
      ? { datePublished: article.publishedAt }
      : {}),
    ...(articleDate(article.updatedAt)
      ? { dateModified: article.updatedAt }
      : {}),
  };
  return JSON.stringify(value).replace(/</g, String.fromCharCode(92) + "u003c");
}
