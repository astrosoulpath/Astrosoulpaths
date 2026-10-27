import s from "@/features/articles/articles.module.css";
export default function Loading() {
  return (
    <main className={s.page} aria-busy="true">
      <section className={s.body}>
        <p role="status">Loading articles…</p>
        <div className={s.grid}>
          {[1, 2, 3].map((key) => (
            <div className={s.skeleton} key={key} aria-hidden="true" />
          ))}
        </div>
      </section>
    </main>
  );
}
