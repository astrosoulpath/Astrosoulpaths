import Link from "next/link";
import { articleFeed, type Article } from "@/features/articles/article-api";
import ArticleCard from "@/features/articles/ArticleCard";
import s from "./remedies.module.css";
export default async function RemedyGuidance() {
    let articles: Article[] = [];
    let failed = false;
    try {
        articles = await articleFeed({ category: "REMEDIES", locale: "en", limit: "6" });
    }
    catch {
        failed = true;
    }
    if (failed)
        return <div className={s.state} role="alert"><h3>Guidance could not be loaded</h3><p>Please try again. Your private chart and account have not been accessed.</p><Link href="/remedies#guidance" prefetch={false}>Retry guidance</Link></div>;
    if (!articles.length)
        return <div className={s.state}><h3>No published remedy articles yet</h3><p>Personal recommendations are available only through the appropriate existing reading or consultation. No generic result has been substituted.</p><Link href="/blog">Explore the Knowledge Center →</Link></div>;
    return <div className={s.grid}>{articles.map(article => <ArticleCard key={article.id} article={article}/>)}</div>;
}
