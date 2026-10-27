import Link from "next/link";
import s from "./cinematic-home.module.css";
export function AstrologerRecruitmentSection() {
  return (
    <section
      id="become-an-astrologer"
      className={s.section}
      aria-labelledby="recruitment-heading"
    >
      <div className={s.sectionHead}>
        <div>
          <p className={s.eyebrow}>For the professional journey</p>
          <h2 id="recruitment-heading">
            Share your wisdom.
            <br />
            <em>Guide with care.</em>
          </h2>
        </div>
        <div>
          <p className={s.bodyCopy}>
            Explore the existing astrologer application process. Profile
            completion, KYC, review and approval requirements apply; submitting
            an application does not guarantee approval.
          </p>
          <Link href="/astrologer/register" className={s.goldButton}>
            Apply as Astrologer ↗
          </Link>
        </div>
      </div>
    </section>
  );
}
