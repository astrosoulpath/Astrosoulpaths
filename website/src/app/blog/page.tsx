import ArticlesIndex from "@/features/articles/ArticlesIndex";
import { metadata as articleMetadata } from "@/features/articles/ArticlesIndex";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return {
    ...articleMetadata,
    ...(params.q || params.offset
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}
export default ArticlesIndex;
