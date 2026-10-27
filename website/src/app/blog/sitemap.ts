import type { MetadataRoute } from "next";
import { articleFeed } from "@/features/articles/article-api";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  // Bounded sitemap response, under the sitemap protocol's 50,000 URL limit.
  // Region-restricted records are intentionally excluded without a country.
  for (let offset = 0; offset < 10000; offset += 25) {
    const rows = await articleFeed({
      locale: "en",
      limit: "25",
      offset: String(offset),
    });
    for (const a of rows)
      entries.push({
        url: "https://astrosoulpath.com/blog/" + a.slug,
        ...(a.updatedAt ? { lastModified: a.updatedAt } : {}),
      });
    if (rows.length < 25) break;
  }
  return [{ url: "https://astrosoulpath.com/blog" }, ...entries];
}
