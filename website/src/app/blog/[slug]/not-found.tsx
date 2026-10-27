import Link from "next/link";
export default function Missing() {
  return (
    <main className="bg-[#faf7f0] text-[#17213a] px-6 py-20 text-center">
      <h1 className="text-4xl font-serif">Article not available</h1>
      <p className="my-6">
        It may not be published or available in your selected region.
      </p>
      <Link
        href="/blog"
        className="inline-flex min-h-12 items-center underline"
      >
        Back to Articles
      </Link>
    </main>
  );
}
